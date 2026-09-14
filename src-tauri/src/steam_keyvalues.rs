//! Strict text KeyValues parser with byte spans: untouched text is never serialized.
use std::ops::Range;
#[derive(Debug)]
pub struct Node {
    pub key: String,
    pub value: Value,
}
#[derive(Debug)]
pub enum Value {
    Text(String, Range<usize>),
    Object(Vec<Node>, usize),
}
struct Parser<'a> {
    text: &'a str,
    pos: usize,
}
impl<'a> Parser<'a> {
    fn skip(&mut self) {
        loop {
            while self
                .text
                .as_bytes()
                .get(self.pos)
                .is_some_and(u8::is_ascii_whitespace)
            {
                self.pos += 1;
            }
            if self.text[self.pos..].starts_with("//") {
                while self.pos < self.text.len() && self.text.as_bytes()[self.pos] != b'\n' {
                    self.pos += 1;
                }
            } else {
                break;
            }
        }
    }
    fn token(&mut self) -> Result<(String, Range<usize>), String> {
        self.skip();
        let start = self.pos;
        if self.text.as_bytes().get(self.pos) == Some(&b'"') {
            self.pos += 1;
            let mut out = String::new();
            while self.pos < self.text.len() {
                let c = self.text[self.pos..].chars().next().unwrap();
                self.pos += c.len_utf8();
                match c {
                    '"' => return Ok((out, start..self.pos)),
                    '\\' => {
                        let c = self.text[self.pos..]
                            .chars()
                            .next()
                            .ok_or("Unterminated escape")?;
                        self.pos += c.len_utf8();
                        match c {
                            'n' => out.push('\n'),
                            'r' => out.push('\r'),
                            't' => out.push('\t'),
                            '\\' | '"' => out.push(c),
                            _ => {
                                out.push('\\');
                                out.push(c);
                            }
                        }
                    }
                    '\0' => return Err("NUL in KeyValues".into()),
                    _ => out.push(c),
                }
            }
            return Err("Unterminated quoted string".into());
        }
        while let Some(&c) = self.text.as_bytes().get(self.pos) {
            if c.is_ascii_whitespace() || b"{}\"".contains(&c) {
                break;
            }
            self.pos += 1;
        }
        let token = &self.text[start..self.pos];
        if token.is_empty() || token.starts_with('#') || token.contains(['[', ']', '\0']) {
            return Err("Unsupported or malformed KeyValues token/directive/condition".into());
        }
        Ok((token.to_string(), start..self.pos))
    }
    fn nodes(&mut self, nested: bool, depth: usize) -> Result<(Vec<Node>, usize), String> {
        if depth > 64 {
            return Err("KeyValues nesting exceeds 64".into());
        }
        let mut nodes = Vec::new();
        loop {
            self.skip();
            let close = self.pos;
            match self.text.as_bytes().get(self.pos) {
                None if !nested => return Ok((nodes, close)),
                Some(b'}') if nested => {
                    self.pos += 1;
                    return Ok((nodes, close));
                }
                None | Some(b'}') => return Err("Unbalanced KeyValues braces".into()),
                _ => (),
            }
            let (key, _) = self.token()?;
            self.skip();
            let value = if self.text.as_bytes().get(self.pos) == Some(&b'{') {
                self.pos += 1;
                let (children, end) = self.nodes(true, depth + 1)?;
                Value::Object(children, end)
            } else {
                let (s, span) = self.token()?;
                Value::Text(s, span)
            };
            nodes.push(Node { key, value });
        }
    }
}
pub fn parse(text: &str) -> Result<Vec<Node>, String> {
    if text.len() > 32 * 1024 * 1024 {
        return Err("KeyValues file exceeds 32 MiB".into());
    }
    Parser {
        text,
        pos: if text.starts_with('\u{feff}') { 3 } else { 0 },
    }
    .nodes(false, 0)
    .map(|v| v.0)
}
pub fn child<'a>(nodes: &'a [Node], key: &str) -> Result<Option<&'a Node>, String> {
    let mut matches = nodes.iter().filter(|n| n.key.eq_ignore_ascii_case(key));
    let node = matches.next();
    if matches.next().is_some() {
        return Err(format!("Ambiguous duplicate KeyValues key: {key}"));
    }
    Ok(node)
}
pub fn object(node: &Node) -> Result<&[Node], String> {
    match &node.value {
        Value::Object(nodes, _) => Ok(nodes),
        _ => Err(format!("Expected object: {}", node.key)),
    }
}
pub fn scalar(nodes: &[Node], key: &str) -> Result<Option<String>, String> {
    match child(nodes, key)? {
        None => Ok(None),
        Some(Node {
            value: Value::Text(s, _),
            ..
        }) => Ok(Some(s.clone())),
        _ => Err(format!("Expected string: {key}")),
    }
}
fn path(app: &str) -> Vec<&str> {
    vec![
        "UserLocalConfigStore",
        "Software",
        "Valve",
        "Steam",
        "apps",
        app,
        "LaunchOptions",
    ]
}
pub fn launch_value(text: &str, app: &str) -> Result<Option<String>, String> {
    let tree = parse(text)?;
    let mut nodes = tree.as_slice();
    let keys = path(app);
    for key in &keys[..keys.len() - 1] {
        match child(nodes, key)? {
            Some(n) => nodes = object(n)?,
            None => return Ok(None),
        }
    }
    scalar(nodes, "LaunchOptions")
}
fn quote(s: &str) -> String {
    format!(
        "\"{}\"",
        s.replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
            .replace('\t', "\\t")
    )
}
pub fn edit_launch(text: &str, app: &str, value: &str) -> Result<String, String> {
    let tree = parse(text)?;
    let root = child(&tree, "UserLocalConfigStore")?.ok_or("Missing UserLocalConfigStore")?;
    let mut current = root;
    let keys = path(app);
    let nl = if text.contains("\r\n") { "\r\n" } else { "\n" };
    for (index, key) in keys.iter().enumerate().skip(1) {
        let nodes = object(current)?;
        if let Some(node) = child(nodes, key)? {
            if index == keys.len() - 1 {
                if let Value::Text(_, span) = &node.value {
                    let mut result = text.to_string();
                    result.replace_range(span.clone(), &quote(value));
                    return Ok(result);
                }
                return Err("LaunchOptions must be a string".into());
            }
            current = node;
        } else {
            let Value::Object(_, close) = &current.value else {
                unreachable!()
            };
            let mut addition = format!(
                "{}\t{}\t\t{}{}",
                nl,
                quote("LaunchOptions"),
                quote(value),
                nl
            );
            for missing in keys[index..keys.len() - 1].iter().rev() {
                addition = format!("{nl}{}{}{{{addition}}}{nl}", quote(missing), nl);
            }
            let mut result = text.to_string();
            result.insert_str(*close, &addition);
            return Ok(result);
        }
    }
    unreachable!()
}
#[cfg(test)]
mod tests {
    use super::*;
    const VDF: &str = "\u{feff}// header\r\n\"UserLocalConfigStore\" { \"Software\" { \"Valve\" { \"Steam\" { \"apps\" { \"42\" { \"LaunchOptions\" \"old\" \"other\" \"keep\" } \"43\" { \"LaunchOptions\" \"unchanged\" } } } } } }";
    #[test]
    fn preserves_other_bytes_and_roundtrips() {
        let value = "ENV=\"é\\folder\" %command%\n\t";
        let edited = edit_launch(VDF, "42", value).unwrap();
        assert_eq!(launch_value(&edited, "42").unwrap(), Some(value.into()));
        assert_eq!(edited, VDF.replacen("\"old\"", &quote(value), 1));
        assert_eq!(
            launch_value(&edited, "43").unwrap(),
            Some("unchanged".into())
        );
    }
    #[test]
    fn creates_missing_path_and_clears() {
        for text in ["UserLocalConfigStore {}", VDF] {
            let added = edit_launch(text, "99", "x").unwrap();
            assert_eq!(launch_value(&added, "99").unwrap(), Some("x".into()));
            let cleared = edit_launch(&added, "99", "").unwrap();
            assert_eq!(launch_value(&cleared, "99").unwrap(), Some("".into()));
        }
    }
    #[test]
    fn rejects_malformed_ambiguous_and_directives() {
        for text in [
            "UserLocalConfigStore {",
            "UserLocalConfigStore {} }",
            "#base foo",
            "UserLocalConfigStore {} [$LINUX]",
            "UserLocalConfigStore { Software {} software {} }",
            "UserLocalConfigStore { Software \"x\" }",
            "UserLocalConfigStore { x \"unterminated }",
        ] {
            assert!(edit_launch(text, "42", "x").is_err(), "{text}");
        }
    }
}

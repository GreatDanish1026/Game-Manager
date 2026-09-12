#[inline]
pub fn dev_log(message: &str) {
    #[cfg(debug_assertions)]
    {
        println!("{}", message);
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = message;
    }
}

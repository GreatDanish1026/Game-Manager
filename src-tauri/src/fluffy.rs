use serde::Serialize;

const FLUFFY_PAGE_URL: &str = "https://www.nexusmods.com/site/mods/818";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FluffySupportStatus {
    pub supported: bool,
    pub matched_game_name: Option<String>,
    pub manager_name: String,
    pub notes: Option<String>,
    pub page_url: String,
    pub match_score: i32,
}

struct SupportedGame {
    canonical_name: &'static str,
    aliases: &'static [&'static str],
    notes: &'static str,
}

/*
 * Fluffy does not publish a Vortex-style machine-readable
 * compatibility manifest.
 *
 * Game Manager therefore uses a conservative list of games known
 * to have Fluffy Mod Manager support. The aliases are intentionally
 * explicit so similarly named games are not marked supported by
 * accident.
 *
 * This list is isolated here so it can be updated easily as Fluffy
 * adds new games.
 */
const SUPPORTED_GAMES: &[SupportedGame] = &[
    SupportedGame {
        canonical_name: "Resident Evil",
        aliases: &[
            "Resident Evil",
            "Resident Evil HD Remaster",
            "Resident Evil Remaster",
            "Resident Evil 1",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 0",
        aliases: &[
            "Resident Evil 0",
            "Resident Evil 0 HD Remaster",
            "Resident Evil Zero",
            "Resident Evil Zero HD Remaster",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil 0.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 2",
        aliases: &["Resident Evil 2", "Resident Evil 2 1998"],
        notes: "Known Fluffy Mod Manager support for the original Resident Evil 2.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 2 Remake",
        aliases: &[
            "Resident Evil 2 Remake",
            "Resident Evil 2 2019",
            "Resident Evil 2 Biohazard RE2",
            "BIOHAZARD RE2",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil 2 Remake.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 3",
        aliases: &[
            "Resident Evil 3",
            "Resident Evil 3 Nemesis",
            "Resident Evil 3 1999",
        ],
        notes: "Known Fluffy Mod Manager support for the original Resident Evil 3.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 3 Remake",
        aliases: &[
            "Resident Evil 3 Remake",
            "Resident Evil 3 2020",
            "Resident Evil 3 Biohazard RE3",
            "BIOHAZARD RE3",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil 3 Remake.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 4",
        aliases: &[
            "Resident Evil 4",
            "Resident Evil 4 Ultimate HD Edition",
            "Resident Evil 4 2005",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil 4.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 4 Remake",
        aliases: &[
            "Resident Evil 4 Remake",
            "Resident Evil 4 2023",
            "Resident Evil 4 Chainsaw Demo",
            "BIOHAZARD RE4",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil 4 Remake.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 5",
        aliases: &["Resident Evil 5", "Resident Evil 5 Gold Edition"],
        notes: "Known Fluffy Mod Manager support for Resident Evil 5.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 6",
        aliases: &["Resident Evil 6"],
        notes: "Known Fluffy Mod Manager support for Resident Evil 6.",
    },
    SupportedGame {
        canonical_name: "Resident Evil 7 Biohazard",
        aliases: &[
            "Resident Evil 7",
            "Resident Evil 7 Biohazard",
            "BIOHAZARD 7 resident evil",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil 7 Biohazard.",
    },
    SupportedGame {
        canonical_name: "Resident Evil Village",
        aliases: &[
            "Resident Evil Village",
            "Resident Evil 8",
            "Resident Evil 8 Village",
            "BIOHAZARD VILLAGE",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil Village.",
    },
    SupportedGame {
        canonical_name: "Resident Evil Requiem",
        aliases: &[
            "Resident Evil Requiem",
            "Resident Evil 9",
            "Resident Evil 9 Requiem",
            "Resident Evil Requiem Demo",
            "Resident Evil 9 Demo",
        ],
        notes: "Known Fluffy Mod Manager support for Resident Evil Requiem / RE9 builds.",
    },
    SupportedGame {
        canonical_name: "Resident Evil Revelations",
        aliases: &["Resident Evil Revelations", "Resident Evil Revelations 1"],
        notes: "Known Fluffy Mod Manager support for Resident Evil Revelations.",
    },
    SupportedGame {
        canonical_name: "Resident Evil Revelations 2",
        aliases: &["Resident Evil Revelations 2"],
        notes: "Known Fluffy Mod Manager support for Resident Evil Revelations 2.",
    },
    SupportedGame {
        canonical_name: "Devil May Cry 4 Special Edition",
        aliases: &[
            "Devil May Cry 4 Special Edition",
            "DMC4 Special Edition",
            "DMC4SE",
        ],
        notes: "Known Fluffy Mod Manager support for Devil May Cry 4 Special Edition.",
    },
    SupportedGame {
        canonical_name: "Devil May Cry 5",
        aliases: &["Devil May Cry 5", "DMC5"],
        notes: "Known Fluffy Mod Manager support for Devil May Cry 5.",
    },
    SupportedGame {
        canonical_name: "Street Fighter V",
        aliases: &[
            "Street Fighter V",
            "Street Fighter 5",
            "Street Fighter V Champion Edition",
        ],
        notes: "Known Fluffy Mod Manager support for Street Fighter V.",
    },
    SupportedGame {
        canonical_name: "Street Fighter 6",
        aliases: &["Street Fighter 6", "Street Fighter VI"],
        notes: "Known Fluffy Mod Manager support for Street Fighter 6.",
    },
    SupportedGame {
        canonical_name: "Monster Hunter Rise",
        aliases: &[
            "Monster Hunter Rise",
            "Monster Hunter Rise Sunbreak",
            "Monster Hunter Rise: Sunbreak",
        ],
        notes: "Known Fluffy Mod Manager support for Monster Hunter Rise / Sunbreak.",
    },
    SupportedGame {
        canonical_name: "Monster Hunter Wilds",
        aliases: &["Monster Hunter Wilds"],
        notes: "Known Fluffy Mod Manager support for Monster Hunter Wilds.",
    },
    SupportedGame {
        canonical_name: "Dragon's Dogma 2",
        aliases: &["Dragon's Dogma 2", "Dragons Dogma 2", "Dragon's Dogma II"],
        notes: "Known Fluffy Mod Manager support for Dragon's Dogma 2.",
    },
    SupportedGame {
        canonical_name: "Dead Rising Deluxe Remaster",
        aliases: &[
            "Dead Rising Deluxe Remaster",
            "Dead Rising Deluxe Remastered",
            "DRDR",
        ],
        notes: "Known Fluffy Mod Manager support for Dead Rising Deluxe Remaster.",
    },
    SupportedGame {
        canonical_name: "Onimusha: Way of the Sword",
        aliases: &[
            "Onimusha Way of the Sword",
            "Onimusha: Way of the Sword",
            "Onimusha 5",
        ],
        notes: "Known Fluffy Mod Manager support for Onimusha: Way of the Sword.",
    },
    SupportedGame {
        canonical_name: "PRAGMATA",
        aliases: &["PRAGMATA", "Pragmata"],
        notes: "Known Fluffy Mod Manager support used by current PRAGMATA mods.",
    },
    SupportedGame {
        canonical_name: "Dino Crisis",
        aliases: &["Dino Crisis", "Dino Crisis 1"],
        notes: "Known Fluffy Mod Manager support for Dino Crisis.",
    },
    SupportedGame {
        canonical_name: "Dino Crisis 2",
        aliases: &["Dino Crisis 2"],
        notes: "Known Fluffy Mod Manager support for Dino Crisis 2.",
    },
    SupportedGame {
        canonical_name: "Bloodstained: Ritual of the Night",
        aliases: &[
            "Bloodstained Ritual of the Night",
            "Bloodstained: Ritual of the Night",
        ],
        notes: "Known Fluffy Mod Manager support for Bloodstained: Ritual of the Night.",
    },
    SupportedGame {
        canonical_name: "Soulcalibur VI",
        aliases: &[
            "Soulcalibur VI",
            "Soul Calibur VI",
            "Soulcalibur 6",
            "Soul Calibur 6",
        ],
        notes: "Known Fluffy Mod Manager support for Soulcalibur VI.",
    },
    SupportedGame {
        canonical_name: "Battlefleet Gothic: Armada 2",
        aliases: &[
            "Battlefleet Gothic Armada 2",
            "Battlefleet Gothic: Armada 2",
            "Battlefleet Gothic Armada II",
        ],
        notes: "Known Fluffy Mod Manager support for Battlefleet Gothic: Armada 2.",
    },
];

fn normalize_game_name(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    for character in value.to_lowercase().chars() {
        match character {
            '™' | '®' | '©' | '℠' => {}

            '&' => {
                output.push_str(" and ");
            }

            character if character.is_alphanumeric() => {
                output.push(character);
            }

            _ => {
                output.push(' ');
            }
        }
    }

    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn remove_store_suffixes(value: &str) -> String {
    let mut normalized = normalize_game_name(value);

    for suffix in [" steam", " gog", " epic", " epic games", " windows", " pc"] {
        if normalized.ends_with(suffix) {
            let new_length = normalized.len() - suffix.len();

            normalized = normalized[..new_length].trim().to_string();
        }
    }

    normalized
}

fn find_supported_game(installed_name: &str) -> Option<(&'static SupportedGame, i32)> {
    let installed = remove_store_suffixes(installed_name);

    if installed.is_empty() {
        return None;
    }

    for game in SUPPORTED_GAMES {
        for alias in game.aliases {
            let candidate = remove_store_suffixes(alias);

            if installed == candidate {
                return Some((game, 100));
            }
        }
    }

    /*
     * Conservative fallback:
     *
     * Only accept containment when the shorter normalized title is
     * at least 12 characters long. This catches storefront suffixes
     * such as "Gold Edition" while avoiding broad matches like
     * "Resident Evil".
     */
    let mut best: Option<(&'static SupportedGame, i32)> = None;

    for game in SUPPORTED_GAMES {
        for alias in game.aliases {
            let candidate = remove_store_suffixes(alias);

            let shorter = installed.len().min(candidate.len());

            if shorter < 12 {
                continue;
            }

            if installed.contains(&candidate) || candidate.contains(&installed) {
                let score = 85;

                if best
                    .as_ref()
                    .map(|(_, current)| score > *current)
                    .unwrap_or(true)
                {
                    best = Some((game, score));
                }
            }
        }
    }

    best
}

#[tauri::command]
pub async fn get_fluffy_support(name: String) -> Result<FluffySupportStatus, String> {
    println!("");
    println!("[FLUFFY] ========================================");
    println!("[FLUFFY] Checking game: {:?}", name);
    println!("[FLUFFY] Normalized: {:?}", normalize_game_name(&name));

    let Some((game, score)) = find_supported_game(&name) else {
        println!("[FLUFFY] No known support match");
        println!("[FLUFFY] ========================================");
        println!("");

        return Ok(FluffySupportStatus {
            supported: false,

            matched_game_name: None,

            manager_name: "Fluffy Mod Manager".to_string(),

            notes: Some(
                "No match was found in Game Manager's conservative Fluffy compatibility list."
                    .to_string(),
            ),

            page_url: FLUFFY_PAGE_URL.to_string(),

            match_score: 0,
        });
    };

    println!("[FLUFFY] Match: {:?}", game.canonical_name);
    println!("[FLUFFY] Score: {}", score);
    println!("[FLUFFY] ========================================");
    println!("");

    Ok(FluffySupportStatus {
        supported: true,

        matched_game_name: Some(game.canonical_name.to_string()),

        manager_name: "Fluffy Mod Manager".to_string(),

        notes: Some(game.notes.to_string()),

        page_url: FLUFFY_PAGE_URL.to_string(),

        match_score: score,
    })
}

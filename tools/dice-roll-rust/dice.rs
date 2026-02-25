use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

/// Simple random number generator using Linear Congruential Generator
struct Rng {
    state: u64,
}

impl Rng {
    fn new() -> Self {
        let seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;
        Rng { state: seed }
    }

    fn next(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(1103515245).wrapping_add(12345);
        self.state
    }

    fn range(&mut self, min: u64, max: u64) -> u64 {
        min + (self.next() % (max - min + 1))
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut sides: u64 = 6;
    let mut count: u64 = 1;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--sides" if i + 1 < args.len() => {
                sides = args[i + 1].parse().unwrap_or(6);
                i += 2;
            }
            "--count" if i + 1 < args.len() => {
                count = args[i + 1].parse().unwrap_or(1);
                i += 2;
            }
            s if !s.starts_with("--") => {
                if let Ok(val) = s.parse::<u64>() {
                    if sides == 6 {
                        sides = val;
                    } else {
                        count = val;
                    }
                }
                i += 1;
            }
            _ => { i += 1; }
        }
    }

    let sides = sides.clamp(2, 100);
    let count = count.clamp(1, 100);

    let mut rng = Rng::new();
    let mut rolls: Vec<u64> = Vec::new();
    let mut total: u64 = 0;

    for _ in 0..count {
        let roll = rng.range(1, sides);
        rolls.push(roll);
        total += roll;
    }

    let rolls_json: Vec<String> = rolls.iter().map(|r| r.to_string()).collect();
    println!(
        r#"{{"rolls":[{}],"total":{},"sides":{},"count":{}}}"#,
        rolls_json.join(","),
        total,
        sides,
        count
    );
}

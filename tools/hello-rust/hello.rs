use std::env;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut name = String::from("World");

    let mut i = 0;
    while i < args.len() {
        if args[i] == "--name" && i + 1 < args.len() {
            name = args[i + 1].clone();
            i += 2;
        } else if !args[i].starts_with("--") {
            name = args[i].clone();
            i += 1;
        } else {
            i += 1;
        }
    }

    println!("Hello, {}! 🦀", name);
}

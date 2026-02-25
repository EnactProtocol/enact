package main

import (
	"fmt"
	"os"
	"runtime"
)

func main() {
	name := "World"
	args := os.Args[1:]

	for i := 0; i < len(args); i++ {
		if args[i] == "--name" && i+1 < len(args) {
			name = args[i+1]
			i++
		} else if len(args[i]) > 0 && args[i][0] != '-' {
			name = args[i]
		}
	}

	fmt.Printf("Hello, %s! 🐹\n", name)
	fmt.Printf("Go version: %s\n", runtime.Version())
}

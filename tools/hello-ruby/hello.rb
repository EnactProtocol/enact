#!/usr/bin/env ruby

name = "World"
i = 0
while i < ARGV.length
  if ARGV[i] == "--name" && i + 1 < ARGV.length
    name = ARGV[i + 1]
    i += 2
  elsif !ARGV[i].start_with?("--")
    name = ARGV[i]
    i += 1
  else
    i += 1
  end
end

puts "Hello, #{name}! 💎"
puts "Ruby version: #{RUBY_VERSION}"

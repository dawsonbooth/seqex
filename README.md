# predex

[![CI](https://github.com/dawsonbooth/predex/actions/workflows/ci.yml/badge.svg)](https://github.com/dawsonbooth/predex/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/predex)](https://www.npmjs.com/package/predex)
[![codecov](https://codecov.io/gh/dawsonbooth/predex/graph/badge.svg)](https://codecov.io/gh/dawsonbooth/predex)
[![license](https://img.shields.io/npm/l/predex)](LICENSE)

Regex-like pattern matching for arbitrary sequences. Instead of matching characters against character classes, match elements of any type against predicate functions.

Built on an NFA engine (Thompson's construction) — O(n \* m) guaranteed, no exponential backtracking.

## Install

```bash
bun add predex
```

## Quick start

```typescript
import { Pattern } from 'predex'

const isEven = (n: number) => n % 2 === 0
const isOdd = (n: number) => n % 2 !== 0

// Build a pattern and compile it
const matcher = Pattern.where<number>(isEven).followedBy(isOdd).followedBy(isEven).compile()

// Find all non-overlapping matches
matcher.findAll([2, 3, 4, 6, 7, 8, 9, 10])
// → [{ start: 0, end: 2, data: [2, 3, 4] },
//    { start: 3, end: 5, data: [6, 7, 8] }]
```

## API

### Building patterns

Start a pattern with `Pattern.where()` or `Pattern.any()`, then chain methods to describe the shape you're looking for.

#### `Pattern.where<T>(fn)` — start with a predicate

```typescript
Pattern.where<number>(n => n > 0)
```

#### `Pattern.any<T>()` — start with a wildcard (matches any element)

```typescript
Pattern.any<string>()
```

#### `.followedBy(fn | pattern)` — append a predicate or sub-pattern

```typescript
Pattern.where<number>(isEven).followedBy(isOdd).followedBy(isEven)

// Sub-patterns work too
const prefix = Pattern.where<number>(isEven).followedBy(isOdd)
Pattern.where<number>(isPositive).followedBy(prefix)
```

#### `.followedByAny()` — append a wildcard

```typescript
Pattern.where<number>(isEven).followedByAny().followedBy(isOdd)
```

### Quantifiers

Quantifiers modify the **last element** in the pattern. All accept an optional `greedy` parameter (default `true`).

| Method               | Regex equivalent | Description         |
| -------------------- | ---------------- | ------------------- |
| `.oneOrMore()`       | `+`              | One or more         |
| `.zeroOrMore()`      | `*`              | Zero or more        |
| `.optional()`        | `?`              | Zero or one         |
| `.times(n)`          | `{n}`            | Exactly n           |
| `.between(min, max)` | `{min,max}`      | Between min and max |

```typescript
// One or more even numbers followed by an odd
Pattern.where<number>(isEven).oneOrMore().followedBy(isOdd)

// Exactly 3 positive numbers
Pattern.where<number>(n => n > 0).times(3)

// Between 2 and 5 elements
Pattern.where<number>(isEven).between(2, 5)
```

#### Greedy vs lazy

By default, quantifiers are greedy (match as many elements as possible). Pass `false` for lazy matching (match as few as possible).

```typescript
// Greedy: consumes as many positives as possible
Pattern.where<number>(isPositive).oneOrMore(true).followedBy(isPositive)
// On [1, 2, 3] → matches [1, 2, 3]

// Lazy: consumes as few positives as possible
Pattern.where<number>(isPositive).oneOrMore(false).followedBy(isPositive)
// On [1, 2, 3] → matches [1, 2]
```

### Alternation

#### `.or(fn | pattern)` — match this pattern or another

```typescript
// Match a positive or negative number
Pattern.where<number>(n => n > 0).or(n => n < 0)

// Alternation with complex sub-patterns
Pattern.where<number>(isEven).followedBy(isOdd).or(Pattern.where<number>(isOdd).followedBy(isEven))
```

#### `Pattern.oneOf<T>(...alternatives)` — multi-way alternation

Cleaner syntax for 3+ branches. Accepts any mix of predicates and patterns.

```typescript
Pattern.oneOf<number>(isEven, isOdd, isZero)

// With sub-patterns
Pattern.oneOf<number>(
  Pattern.where<number>(isEven).followedBy(isOdd),
  Pattern.where<number>(isOdd).followedBy(isEven),
  Pattern.where<number>(isZero).followedBy(isZero),
)

// Composable — chain quantifiers, followedBy, etc.
Pattern.oneOf<number>(isEven, isOdd).oneOrMore().followedBy(isZero)
```

### Anchors

#### `.atStart()` — anchor to the beginning of the sequence

```typescript
Pattern.where<number>(isEven)
  .atStart()
  .compile()
  .findAll([2, 3, 4]) // → [{ start: 0, end: 0, data: [2] }]
  .findAll([1, 2, 4]) // → []
```

#### `.atEnd()` — anchor to the end of the sequence

```typescript
Pattern.where<number>(isEven).atEnd().compile().findAll([1, 3, 4]) // → [{ start: 2, end: 2, data: [4] }]
```

### Compiling and matching

#### `.compile()` — compile the pattern into a Matcher

Patterns are immutable descriptions. Call `.compile()` to get a `Matcher` that can be used repeatedly against different sequences.

```typescript
const matcher = Pattern.where<number>(isEven).compile()
```

#### `matcher.findAll(sequence)` — find all non-overlapping matches

Returns an array of `MatchResult<T>` objects with `start`, `end`, and `data` properties. Accepts any `Iterable<T>` — arrays, generators, Sets, Maps, or custom iterables.

```typescript
matcher.findAll([1, 2, 3, 4, 5, 6])
// → [{ start: 1, end: 1, data: [2] },
//    { start: 3, end: 3, data: [4] },
//    { start: 5, end: 5, data: [6] }]

// Works with any iterable
function* naturals(n: number) {
  for (let i = 1; i <= n; i++) yield i
}
matcher.findAll(naturals(6))
// → same result
```

#### `matcher.find(sequence)` — find the first match

Returns a single `MatchResult<T>` or `null`. For iterables, stops consuming elements as soon as a match is found.

```typescript
matcher.find([1, 2, 3, 4]) // → { start: 1, end: 1, data: [2] }
matcher.find([1, 3, 5]) // → null
```

#### `matcher.test(sequence)` — check if any match exists

Returns a boolean.

```typescript
matcher.test([1, 2, 3]) // → true
matcher.test([1, 3, 5]) // → false
```

### Streaming

For data that arrives incrementally (event streams, network packets, sensor readings), use the push-based scanner API.

#### `matcher.scanner()` — create a streaming scanner

```typescript
const scanner = matcher.scanner()

for await (const event of eventSource) {
  for (const match of scanner.push(event)) {
    handleMatch(match) // matches emitted as soon as they become definitive
  }
}

// Signal end-of-stream to flush pending matches (greedy, atEnd anchors)
for (const match of scanner.end()) {
  handleMatch(match)
}
```

`push(element)` advances the NFA simulation by one element and returns any matches that have become definitive. `end()` signals that no more elements will arrive, resolving pending greedy matches and `atEnd` anchors.

For greedy patterns, matches are held until the greedy quantifier can no longer extend (i.e., the simulation dies). For lazy patterns, matches emit from `push()` as early as possible.

## Works with any type

The library is generic over `<T>` — match numbers, strings, objects, or anything else.

```typescript
// Strings
const matcher = Pattern.where<string>(s => s.startsWith('a'))
  .followedBy(s => s.length > 3)
  .compile()

matcher.findAll(['apple', 'banana', 'ant', 'elephant'])
// → [{ start: 0, end: 1, data: ['apple', 'banana'] },
//    { start: 2, end: 3, data: ['ant', 'elephant'] }]

// Objects
interface Event {
  type: string
  level: number
}

const matcher = Pattern.where<Event>(e => e.type === 'error')
  .oneOrMore()
  .followedBy(e => e.type === 'recovery')
  .compile()
```

## Advanced patterns

Each predicate sees a single element in isolation. For patterns that depend on relationships between elements, there are two approaches.

### Pre-processing

Transform the sequence so each element carries the context it needs. This is pure and composable.

```typescript
// Detect runs of 3+ strictly increasing numbers
const nums = [1, 3, 5, 2, 4, 8, 12, 7]
const pairs = nums.slice(0, -1).map((n, i) => ({ value: n, next: nums[i + 1] }))

const m = Pattern.where<(typeof pairs)[number]>(p => p.next > p.value)
  .between(2, Infinity)
  .compile()

m.findAll(pairs) // finds [1,3,5] and [2,4,8,12]
```

### Closure variables

When a later predicate needs to reference what an earlier one matched, use a shared variable. The NFA evaluates predicates left-to-right during simulation, so the ordering is reliable.

```typescript
// Match open tag, content, then the matching close tag
let openName = ''

const m = Pattern.where<Tag>(t => {
  if (t.kind === 'open') {
    openName = t.name
    return true
  }
  return false
})
  .followedBy(Pattern.where<Tag>(t => t.kind === 'text').oneOrMore())
  .followedBy(t => t.kind === 'close' && t.name === openName)
  .compile()
```

## Tests

```bash
bun test
```

## How it works

1. The fluent `Pattern` builder constructs an AST (abstract syntax tree) of pattern nodes
2. `.compile()` converts the AST into an NFA (nondeterministic finite automaton) using Thompson's construction
3. The matching engine simulates the NFA using the standard Thompson algorithm — tracking all active states simultaneously
4. Each element is tested against predicate transitions on active states to advance the simulation
5. This gives O(n \* m) time complexity where n is the sequence length and m is the pattern size — no pathological backtracking cases

For arrays, the engine runs the full simulation in a tight loop. For other iterables and the streaming scanner, the same NFA simulation is broken into per-element steps with buffer-and-replay for `findAll` semantics.

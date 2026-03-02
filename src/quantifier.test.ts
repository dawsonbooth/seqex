import { describe, expect, test } from 'bun:test'
import { Pattern } from './pattern'
import { isEven, isNegative, isOdd, isPositive, isZero } from './test-predicates'

describe('Quantifiers', () => {
  describe('oneOrMore (+)', () => {
    test('matches one element', () => {
      const m = Pattern.where<number>(isEven).oneOrMore().compile()
      expect(m.findAll([1, 2, 3])).toEqual([{ start: 1, end: 1, data: [2] }])
    })

    test('matches multiple consecutive elements (greedy)', () => {
      const m = Pattern.where<number>(isEven).oneOrMore().compile()
      expect(m.findAll([2, 4, 6, 3])).toEqual([{ start: 0, end: 2, data: [2, 4, 6] }])
    })

    test('finds multiple separate runs', () => {
      const m = Pattern.where<number>(isEven).oneOrMore().compile()
      expect(m.findAll([2, 4, 1, 6, 8])).toEqual([
        { start: 0, end: 1, data: [2, 4] },
        { start: 3, end: 4, data: [6, 8] },
      ])
    })

    test('no match when zero elements satisfy', () => {
      const m = Pattern.where<number>(isEven).oneOrMore().compile()
      expect(m.findAll([1, 3, 5])).toEqual([])
    })
  })

  describe('zeroOrMore (*)', () => {
    test('matches multiple consecutive elements', () => {
      // Pattern: even* odd — greedy even* then an odd
      const m = Pattern.where<number>(isEven).zeroOrMore().followedBy(isOdd).compile()
      expect(m.findAll([2, 4, 3])).toEqual([{ start: 0, end: 2, data: [2, 4, 3] }])
    })

    test('matches with zero occurrences of quantified element', () => {
      // even* odd — if sequence starts with odd, even* matches zero
      const m = Pattern.where<number>(isEven).zeroOrMore().followedBy(isOdd).compile()
      expect(m.findAll([3, 5])).toEqual([
        { start: 0, end: 0, data: [3] },
        { start: 1, end: 1, data: [5] },
      ])
    })
  })

  describe('optional (?)', () => {
    test('matches with the optional element present', () => {
      // even? odd — optional even then odd
      const m = Pattern.where<number>(isEven).optional().followedBy(isOdd).compile()
      expect(m.findAll([2, 3])).toEqual([{ start: 0, end: 1, data: [2, 3] }])
    })

    test('matches without the optional element', () => {
      const m = Pattern.where<number>(isEven).optional().followedBy(isOdd).compile()
      expect(m.findAll([3, 5])).toEqual([
        { start: 0, end: 0, data: [3] },
        { start: 1, end: 1, data: [5] },
      ])
    })
  })

  describe('times({n})', () => {
    test('matches exactly n elements', () => {
      const m = Pattern.where<number>(isEven).times(3).compile()
      expect(m.findAll([2, 4, 6, 8])).toEqual([{ start: 0, end: 2, data: [2, 4, 6] }])
    })

    test('does not match fewer than n elements', () => {
      const m = Pattern.where<number>(isEven).times(3).compile()
      expect(m.findAll([2, 4, 1])).toEqual([])
    })
  })

  describe('between({n,m})', () => {
    test('matches minimum count', () => {
      // even{2,4} — at least 2, at most 4
      const m = Pattern.where<number>(isEven).between(2, 4).compile()
      expect(m.findAll([2, 4, 1])).toEqual([{ start: 0, end: 1, data: [2, 4] }])
    })

    test('matches up to maximum count (greedy)', () => {
      const m = Pattern.where<number>(isEven).between(2, 4).compile()
      expect(m.findAll([2, 4, 6, 8, 10, 1])).toEqual([{ start: 0, end: 3, data: [2, 4, 6, 8] }])
    })

    test('does not match below minimum', () => {
      const m = Pattern.where<number>(isEven).between(3, 5).compile()
      expect(m.findAll([2, 4, 1])).toEqual([])
    })
  })

  describe('greedy vs lazy', () => {
    test('greedy oneOrMore matches as many as possible', () => {
      // positive+ positive — greedy: consumes as many as possible before yielding
      const m = Pattern.where<number>(isPositive).oneOrMore(true).followedBy(isPositive).compile()
      expect(m.findAll([1, 2, 3])).toEqual([{ start: 0, end: 2, data: [1, 2, 3] }])
    })

    test('lazy oneOrMore matches as few as possible', () => {
      // positive+? positive — lazy: consumes minimum before yielding
      const m = Pattern.where<number>(isPositive).oneOrMore(false).followedBy(isPositive).compile()
      expect(m.findAll([1, 2, 3])).toEqual([{ start: 0, end: 1, data: [1, 2] }])
    })

    test('greedy zeroOrMore consumes as many as possible', () => {
      // even* even — greedy: consume all evens in loop, last one satisfies followedBy
      const m = Pattern.where<number>(isEven).zeroOrMore(true).followedBy(isEven).compile()
      expect(m.findAll([2, 4, 6])).toEqual([{ start: 0, end: 2, data: [2, 4, 6] }])
    })

    test('lazy zeroOrMore consumes as few as possible', () => {
      // even*? even — lazy: skip loop, match each even individually
      const m = Pattern.where<number>(isEven).zeroOrMore(false).followedBy(isEven).compile()
      expect(m.findAll([2, 4, 6])).toEqual([
        { start: 0, end: 0, data: [2] },
        { start: 1, end: 1, data: [4] },
        { start: 2, end: 2, data: [6] },
      ])
    })

    test('greedy optional prefers to include the element', () => {
      // even? even — greedy: include optional even, then match next
      const m = Pattern.where<number>(isEven).optional(true).followedBy(isEven).compile()
      expect(m.findAll([2, 4])).toEqual([{ start: 0, end: 1, data: [2, 4] }])
    })

    test('lazy optional prefers to skip the element', () => {
      // even?? even — lazy: skip optional, match each even alone
      const m = Pattern.where<number>(isEven).optional(false).followedBy(isEven).compile()
      expect(m.findAll([2, 4])).toEqual([
        { start: 0, end: 0, data: [2] },
        { start: 1, end: 1, data: [4] },
      ])
    })

    test('greedy between consumes up to max', () => {
      const m = Pattern.where<number>(isEven).between(1, 3, true).followedBy(isOdd).compile()
      expect(m.findAll([2, 4, 6, 3])).toEqual([{ start: 0, end: 3, data: [2, 4, 6, 3] }])
    })

    test('lazy between consumes only min', () => {
      const m = Pattern.where<number>(isEven).between(1, 3, false).followedBy(isOdd).compile()
      // Lazy: consume 1 even (the minimum), but 4 isn't odd so must backtrack...
      // actually [2] then need odd — 4 is not odd. So try [2,4] then 6 not odd. Then [2,4,6] then 3 is odd.
      // Lazy between still needs to find a valid match, it just prefers fewer.
      expect(m.findAll([2, 4, 6, 3])).toEqual([{ start: 0, end: 3, data: [2, 4, 6, 3] }])
    })

    test('lazy between takes minimum when possible', () => {
      // Use a sequence where the element after min evens is already odd
      const m = Pattern.where<number>(isEven).between(1, 3, false).followedBy(isOdd).compile()
      expect(m.findAll([2, 3, 4])).toEqual([{ start: 0, end: 1, data: [2, 3] }])
    })
  })

  describe('quantifier with sequence', () => {
    test('quantifier on last element of multi-step pattern', () => {
      // odd even+ — an odd followed by one or more evens
      const m = Pattern.where<number>(isOdd).followedBy(isEven).oneOrMore().compile()
      expect(m.findAll([3, 2, 4, 6, 1])).toEqual([{ start: 0, end: 3, data: [3, 2, 4, 6] }])
    })

    test('quantifier followed by more predicates', () => {
      // even+ odd even — one or more evens, then odd, then even
      const m = Pattern.where<number>(isEven)
        .oneOrMore()
        .followedBy(isOdd)
        .followedBy(isEven)
        .compile()
      expect(m.findAll([2, 4, 3, 8])).toEqual([{ start: 0, end: 3, data: [2, 4, 3, 8] }])
    })
  })

  describe('between edge cases', () => {
    test('between(0, max) allows zero occurrences', () => {
      // even{0,2} odd — zero to two evens, then odd
      const m = Pattern.where<number>(isEven).between(0, 2).followedBy(isOdd).compile()

      expect(m.findAll([3])).toEqual([{ start: 0, end: 0, data: [3] }])
      expect(m.findAll([2, 3])).toEqual([{ start: 0, end: 1, data: [2, 3] }])
      expect(m.findAll([2, 4, 3])).toEqual([{ start: 0, end: 2, data: [2, 4, 3] }])
    })

    test('between(n, n) is equivalent to times(n)', () => {
      const m1 = Pattern.where<number>(isEven).times(3).compile()
      const m2 = Pattern.where<number>(isEven).between(3, 3).compile()

      const seq = [2, 4, 6, 8, 1]
      expect(m1.findAll(seq)).toEqual(m2.findAll(seq))
    })

    test('between(min, Infinity) is open-ended', () => {
      const m = Pattern.where<number>(isEven).between(2, Infinity).compile()

      expect(m.findAll([2, 4, 1])).toEqual([{ start: 0, end: 1, data: [2, 4] }])
      expect(m.findAll([2, 4, 6, 8, 1])).toEqual([{ start: 0, end: 3, data: [2, 4, 6, 8] }])
      expect(m.findAll([2, 1])).toEqual([])
    })
  })

  describe('quantifier combinations', () => {
    test('multiple quantifier types in one pattern', () => {
      // even{2} odd+ zero? negative
      const m = Pattern.where<number>(isEven)
        .times(2)
        .followedBy(isOdd)
        .oneOrMore()
        .followedBy(isZero)
        .optional()
        .followedBy(isNegative)
        .compile()

      // All parts present
      expect(m.findAll([2, 4, 3, 5, 0, -1])).toEqual([
        { start: 0, end: 5, data: [2, 4, 3, 5, 0, -1] },
      ])

      // Without optional zero
      expect(m.findAll([2, 4, 3, -1])).toEqual([{ start: 0, end: 3, data: [2, 4, 3, -1] }])

      // Not enough evens
      expect(m.findAll([2, 3, -1])).toEqual([])
    })

    test('multiple zeroOrMore in sequence', () => {
      // even* odd* negative
      const m = Pattern.where<number>(isEven)
        .zeroOrMore()
        .followedBy(isOdd)
        .zeroOrMore()
        .followedBy(isNegative)
        .compile()

      expect(m.findAll([2, 4, 3, 5, -1])).toEqual([{ start: 0, end: 4, data: [2, 4, 3, 5, -1] }])
      // Zero odds
      expect(m.findAll([2, 4, -1])).toEqual([{ start: 0, end: 2, data: [2, 4, -1] }])
      // Zero evens
      expect(m.findAll([3, 5, -1])).toEqual([{ start: 0, end: 2, data: [3, 5, -1] }])
      // Both zero
      expect(m.findAll([-1])).toEqual([{ start: 0, end: 0, data: [-1] }])
    })

    test('quantifiers + wildcards + anchors combined', () => {
      // odd+ any{3} even{2} $
      const m = Pattern.where<number>(isOdd)
        .oneOrMore()
        .followedByAny()
        .times(3)
        .followedBy(isEven)
        .times(2)
        .atEnd()
        .compile()

      expect(m.findAll([1, 3, 5, 7, 8, 2, 4])).toEqual([
        { start: 0, end: 6, data: [1, 3, 5, 7, 8, 2, 4] },
      ])
      // Last element not even — no match
      expect(m.findAll([1, 3, 5, 7, 8, 2, 3])).toEqual([])
      // Not enough elements
      expect(m.findAll([1, 2, 3, 4, 6])).toEqual([])
    })

    test('multiple consecutive optionals', () => {
      // even? odd? zero
      const m = Pattern.where<number>(isEven)
        .optional()
        .followedBy(isOdd)
        .optional()
        .followedBy(isZero)
        .compile()

      expect(m.findAll([2, 3, 0])).toEqual([{ start: 0, end: 2, data: [2, 3, 0] }])
      expect(m.findAll([2, 0])).toEqual([{ start: 0, end: 1, data: [2, 0] }])
      expect(m.findAll([3, 0])).toEqual([{ start: 0, end: 1, data: [3, 0] }])
      expect(m.findAll([0])).toEqual([{ start: 0, end: 0, data: [0] }])
    })
  })

  describe('pathological patterns', () => {
    test('does not exhibit exponential behavior', () => {
      // Pattern: positive+ positive+ positive+ — could be pathological with backtracking
      // With NFA simulation this should be O(n * m)
      const m = Pattern.where<number>(isPositive)
        .oneOrMore()
        .followedBy(Pattern.where<number>(isPositive).oneOrMore())
        .followedBy(Pattern.where<number>(isPositive).oneOrMore())
        .followedBy(n => n === 0)
        .compile()

      const seq = Array.from({ length: 100 }, () => 1).concat([0])
      const start = performance.now()
      const results = m.findAll(seq)
      const elapsed = performance.now() - start

      expect(results).toHaveLength(1)
      expect(elapsed).toBeLessThan(1000) // should be <10ms, 1s is generous safety margin
    })
  })
})

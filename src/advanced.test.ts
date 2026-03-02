import { describe, expect, test } from 'bun:test'
import { Pattern } from './pattern'
import { isEven, isNegative, isOdd, isPositive, isZero } from './test-predicates'

describe('Alternation', () => {
  test('matches either branch', () => {
    const m = Pattern.where<number>(isPositive).or(Pattern.where<number>(isNegative)).compile()

    expect(m.findAll([1, -2, 0, 3])).toEqual([
      { start: 0, end: 0, data: [1] },
      { start: 1, end: 1, data: [-2] },
      { start: 3, end: 3, data: [3] },
    ])
  })

  test('or() with a raw predicate function', () => {
    const m = Pattern.where<number>(isPositive).or(isNegative).compile()

    expect(m.findAll([1, -2, 0, 3])).toEqual([
      { start: 0, end: 0, data: [1] },
      { start: 1, end: 1, data: [-2] },
      { start: 3, end: 3, data: [3] },
    ])
  })

  test('chained or() with 3+ branches', () => {
    const m = Pattern.where<number>(isPositive).or(isNegative).or(isZero).compile()

    // Everything matches one of the three branches
    expect(m.findAll([1, -2, 0, 3])).toEqual([
      { start: 0, end: 0, data: [1] },
      { start: 1, end: 1, data: [-2] },
      { start: 2, end: 2, data: [0] },
      { start: 3, end: 3, data: [3] },
    ])
  })

  test('chained or() with sequence branches', () => {
    // (even odd) | (odd even) | (zero zero)
    const m = Pattern.where<number>(isEven)
      .followedBy(isOdd)
      .or(Pattern.where<number>(isOdd).followedBy(isEven))
      .or(Pattern.where<number>(isZero).followedBy(isZero))
      .compile()

    expect(m.findAll([2, 3, 5, 4, 0, 0])).toEqual([
      { start: 0, end: 1, data: [2, 3] },
      { start: 2, end: 3, data: [5, 4] },
      { start: 4, end: 5, data: [0, 0] },
    ])
  })

  test('alternation followed by more predicates', () => {
    // (positive | negative) zero
    const m = Pattern.where<number>(isPositive)
      .or(Pattern.where<number>(isNegative))
      .followedBy(isZero)
      .compile()

    expect(m.findAll([5, 0, -3, 0, 0])).toEqual([
      { start: 0, end: 1, data: [5, 0] },
      { start: 2, end: 3, data: [-3, 0] },
    ])
  })

  test('no match when neither branch matches', () => {
    const m = Pattern.where<number>(isPositive).or(Pattern.where<number>(isNegative)).compile()

    expect(m.findAll([0, 0, 0])).toEqual([])
  })
})

describe('Anchors', () => {
  test('atStart only matches at the beginning', () => {
    const m = Pattern.where<number>(isEven).atStart().compile()

    expect(m.findAll([2, 3, 4])).toEqual([{ start: 0, end: 0, data: [2] }])
  })

  test('atStart fails when first element does not match', () => {
    const m = Pattern.where<number>(isEven).atStart().compile()
    expect(m.findAll([1, 2, 4])).toEqual([])
  })

  test('atEnd only matches at the end', () => {
    const m = Pattern.where<number>(isEven).atEnd().compile()

    expect(m.findAll([1, 3, 4])).toEqual([{ start: 2, end: 2, data: [4] }])
  })

  test('atEnd fails when last element does not match', () => {
    const m = Pattern.where<number>(isEven).atEnd().compile()
    expect(m.findAll([2, 4, 3])).toEqual([])
  })

  test('atStart + atEnd anchors the entire sequence', () => {
    const m = Pattern.where<number>(isEven).oneOrMore().atStart().atEnd().compile()

    expect(m.test([2, 4, 6])).toBe(true)
    expect(m.test([2, 4, 3])).toBe(false)
    expect(m.test([1, 2, 4])).toBe(false)
  })

  test('atStart with multi-step pattern', () => {
    const m = Pattern.where<number>(isEven).followedBy(isOdd).atStart().compile()

    expect(m.findAll([2, 3, 4, 5])).toEqual([{ start: 0, end: 1, data: [2, 3] }])
    expect(m.findAll([1, 2, 3])).toEqual([])
  })

  test('atEnd with quantifier', () => {
    const m = Pattern.where<number>(isEven).oneOrMore().atEnd().compile()

    expect(m.findAll([1, 3, 2, 4, 6])).toEqual([{ start: 2, end: 4, data: [2, 4, 6] }])
    expect(m.findAll([2, 4, 1])).toEqual([])
  })

  test('atStart with alternation', () => {
    const m = Pattern.where<number>(isPositive).or(isNegative).atStart().compile()

    expect(m.findAll([1, 2, 3])).toEqual([{ start: 0, end: 0, data: [1] }])
    expect(m.findAll([-1, 2, 3])).toEqual([{ start: 0, end: 0, data: [-1] }])
    expect(m.findAll([0, 1, 2])).toEqual([])
  })

  test('atEnd with alternation', () => {
    const m = Pattern.where<number>(isPositive).or(isNegative).atEnd().compile()

    expect(m.findAll([0, 0, 1])).toEqual([{ start: 2, end: 2, data: [1] }])
    expect(m.findAll([0, 0, -1])).toEqual([{ start: 2, end: 2, data: [-1] }])
    expect(m.findAll([1, 2, 0])).toEqual([])
  })

  test('atStart with quantifier', () => {
    const m = Pattern.where<number>(isEven).oneOrMore().atStart().compile()

    expect(m.findAll([2, 4, 6, 1])).toEqual([{ start: 0, end: 2, data: [2, 4, 6] }])
    expect(m.findAll([1, 2, 4])).toEqual([])
  })
})

describe('Wildcard', () => {
  test('any() matches any single element', () => {
    const m = Pattern.any<number>().compile()

    expect(m.findAll([1, 2, 3])).toEqual([
      { start: 0, end: 0, data: [1] },
      { start: 1, end: 1, data: [2] },
      { start: 2, end: 2, data: [3] },
    ])
  })

  test('followedByAny() in a sequence', () => {
    // even, any, odd
    const m = Pattern.where<number>(isEven).followedByAny().followedBy(isOdd).compile()

    expect(m.findAll([2, 99, 3])).toEqual([{ start: 0, end: 2, data: [2, 99, 3] }])
  })

  test('any with oneOrMore', () => {
    const m = Pattern.any<number>().oneOrMore().followedBy(isOdd).compile()

    expect(m.findAll([1, 2, 3])).toEqual([{ start: 0, end: 2, data: [1, 2, 3] }])
  })

  test('any with zeroOrMore', () => {
    const m = Pattern.any<number>().zeroOrMore().followedBy(isOdd).compile()

    expect(m.findAll([2, 4, 3])).toEqual([{ start: 0, end: 2, data: [2, 4, 3] }])
    expect(m.findAll([3])).toEqual([{ start: 0, end: 0, data: [3] }])
  })

  test('any with optional', () => {
    const m = Pattern.any<number>().optional().followedBy(isOdd).compile()

    expect(m.findAll([2, 3])).toEqual([{ start: 0, end: 1, data: [2, 3] }])
    expect(m.findAll([3])).toEqual([{ start: 0, end: 0, data: [3] }])
  })

  test('any with times', () => {
    const m = Pattern.any<number>().times(2).followedBy(isOdd).compile()

    expect(m.findAll([1, 2, 3])).toEqual([{ start: 0, end: 2, data: [1, 2, 3] }])
    expect(m.findAll([1, 3])).toEqual([])
  })
})

describe('Generic types', () => {
  test('works with strings', () => {
    const startsWithA = (s: string) => s.startsWith('a')
    const isLong = (s: string) => s.length > 3

    const m = Pattern.where<string>(startsWithA).followedBy(isLong).compile()

    expect(m.findAll(['apple', 'banana', 'ant', 'elephant'])).toEqual([
      { start: 0, end: 1, data: ['apple', 'banana'] },
      { start: 2, end: 3, data: ['ant', 'elephant'] },
    ])
  })

  test('works with objects', () => {
    interface Person {
      name: string
      age: number
    }
    const isAdult = (p: Person) => p.age >= 18
    const isMinor = (p: Person) => p.age < 18

    const people: Person[] = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 10 },
      { name: 'Carol', age: 25 },
    ]

    const m = Pattern.where<Person>(isAdult).followedBy(isMinor).compile()

    expect(m.findAll(people)).toEqual([
      {
        start: 0,
        end: 1,
        data: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 10 },
        ],
      },
    ])
  })
})

describe('Zero-length matches', () => {
  test('standalone zeroOrMore does not produce zero-length matches', () => {
    // even* alone could match zero elements at every position — engine should skip these
    const m = Pattern.where<number>(isEven).zeroOrMore().compile()
    expect(m.findAll([1, 3, 5])).toEqual([])
  })

  test('standalone optional does not produce zero-length matches', () => {
    const m = Pattern.where<number>(isEven).optional().compile()
    // Should only match where there's an actual even number, not "zero evens" at every position
    expect(m.findAll([1, 2, 3])).toEqual([{ start: 1, end: 1, data: [2] }])
  })
})

describe('Complex patterns', () => {
  test('quantifier + alternation', () => {
    // (positive | negative)+ zero
    const m = Pattern.where<number>(isPositive)
      .or(Pattern.where<number>(isNegative))
      .oneOrMore()
      .followedBy(isZero)
      .compile()

    expect(m.findAll([1, -2, 3, 0, 5, 0])).toEqual([
      { start: 0, end: 3, data: [1, -2, 3, 0] },
      { start: 4, end: 5, data: [5, 0] },
    ])
  })

  test('nested quantifiers via followedBy(pattern)', () => {
    // (even odd)+ — repeating pairs
    const pair = Pattern.where<number>(isEven).followedBy(isOdd)
    const m = Pattern.where<number>(isEven).followedBy(isOdd).followedBy(pair).compile()

    // Matches exactly 2 pairs (even, odd, even, odd)
    expect(m.findAll([2, 3, 4, 5, 6])).toEqual([{ start: 0, end: 3, data: [2, 3, 4, 5] }])
  })

  test('optional in the middle of a sequence', () => {
    // positive zero? negative — positive, optionally zero, then negative
    const m = Pattern.where<number>(isPositive)
      .followedBy(isZero)
      .optional()
      .followedBy(isNegative)
      .compile()

    // With zero in between
    expect(m.findAll([5, 0, -3])).toEqual([{ start: 0, end: 2, data: [5, 0, -3] }])

    // Without zero
    expect(m.findAll([5, -3])).toEqual([{ start: 0, end: 1, data: [5, -3] }])
  })

  test('lazy quantifier on alternation', () => {
    // (positive | negative)+? (positive | negative) — lazy takes minimum
    const branch = Pattern.where<number>(isPositive).or(isNegative)
    const m = branch.oneOrMore(false).followedBy(branch).compile()

    expect(m.findAll([1, -2, 3])).toEqual([{ start: 0, end: 1, data: [1, -2] }])
  })
})

describe('Complex data types', () => {
  test('nested objects', () => {
    interface Order {
      customer: { name: string; tier: string }
      total: number
    }

    const orders: Order[] = [
      { customer: { name: 'Alice', tier: 'gold' }, total: 500 },
      { customer: { name: 'Bob', tier: 'silver' }, total: 50 },
      { customer: { name: 'Carol', tier: 'gold' }, total: 200 },
    ]

    const m = Pattern.where<Order>(o => o.customer.tier === 'gold')
      .followedBy(o => o.customer.tier !== 'gold')
      .compile()

    expect(m.findAll(orders)).toEqual([{ start: 0, end: 1, data: [orders[0], orders[1]] }])
  })

  test('class instances', () => {
    class Vec2 {
      constructor(
        public x: number,
        public y: number,
      ) {}
      get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2)
      }
    }

    const points = [new Vec2(1, 0), new Vec2(3, 4), new Vec2(0, 1), new Vec2(10, 10)]

    const m = Pattern.where<Vec2>(v => v.magnitude > 2)
      .oneOrMore()
      .compile()

    expect(m.findAll(points)).toEqual([
      { start: 1, end: 1, data: [points[1]] },
      { start: 3, end: 3, data: [points[3]] },
    ])
  })

  test('sequences containing null and undefined', () => {
    const seq: (string | null | undefined)[] = ['a', null, 'b', undefined, 'c']

    const m = Pattern.where<string | null | undefined>(x => x == null).compile()

    expect(m.findAll(seq)).toEqual([
      { start: 1, end: 1, data: [null] },
      { start: 3, end: 3, data: [undefined] },
    ])
  })

  test('arrays as elements', () => {
    const matrix = [[1, 2], [3, 4], [5], [6, 7, 8]]

    const m = Pattern.where<number[]>(row => row.length === 2)
      .oneOrMore()
      .followedBy(row => row.length !== 2)
      .compile()

    expect(m.findAll(matrix)).toEqual([{ start: 0, end: 2, data: [[1, 2], [3, 4], [5]] }])
  })

  test('union/discriminated union types', () => {
    type Token =
      | { kind: 'number'; value: number }
      | { kind: 'op'; value: string }
      | { kind: 'paren'; value: '(' | ')' }

    const tokens: Token[] = [
      { kind: 'number', value: 1 },
      { kind: 'op', value: '+' },
      { kind: 'number', value: 2 },
      { kind: 'op', value: '*' },
      { kind: 'number', value: 3 },
    ]

    // Match: number op number
    const m = Pattern.where<Token>(t => t.kind === 'number')
      .followedBy(t => t.kind === 'op')
      .followedBy(t => t.kind === 'number')
      .compile()

    expect(m.findAll(tokens)).toEqual([
      { start: 0, end: 2, data: [tokens[0], tokens[1], tokens[2]] },
      // Next search starts at index 3 (op), so [2,3,4] is not found
    ])

    // find() gets the first one
    expect(m.find(tokens)).toEqual({
      start: 0,
      end: 2,
      data: [tokens[0], tokens[1], tokens[2]],
    })
  })

  test('predicates using methods and computed properties', () => {
    const dates = [
      new Date('2024-01-15'),
      new Date('2024-02-20'),
      new Date('2024-03-10'),
      new Date('2024-04-05'),
    ]

    // Match consecutive dates in the first quarter (Jan-Mar)
    const m = Pattern.where<Date>(d => d.getMonth() < 3)
      .oneOrMore()
      .compile()

    expect(m.findAll(dates)).toEqual([{ start: 0, end: 2, data: [dates[0], dates[1], dates[2]] }])
  })
})

describe('Pattern.oneOf()', () => {
  test('with raw predicates', () => {
    const m = Pattern.oneOf<number>(isPositive, isNegative, isZero).compile()

    expect(m.findAll([1, -2, 0, 3])).toEqual([
      { start: 0, end: 0, data: [1] },
      { start: 1, end: 1, data: [-2] },
      { start: 2, end: 2, data: [0] },
      { start: 3, end: 3, data: [3] },
    ])
  })

  test('with Pattern instances', () => {
    const m = Pattern.oneOf<number>(
      Pattern.where<number>(isEven).followedBy(isOdd),
      Pattern.where<number>(isOdd).followedBy(isEven),
      Pattern.where<number>(isZero).followedBy(isZero),
    ).compile()

    expect(m.findAll([2, 3, 5, 4, 0, 0])).toEqual([
      { start: 0, end: 1, data: [2, 3] },
      { start: 2, end: 3, data: [5, 4] },
      { start: 4, end: 5, data: [0, 0] },
    ])
  })

  test('mixed predicates and patterns', () => {
    const m = Pattern.oneOf<number>(
      isZero,
      Pattern.where<number>(isEven).followedBy(isOdd),
    ).compile()

    expect(m.findAll([0, 2, 3])).toEqual([
      { start: 0, end: 0, data: [0] },
      { start: 1, end: 2, data: [2, 3] },
    ])
  })

  test('single alternative is valid', () => {
    const m = Pattern.oneOf<number>(isEven).compile()
    expect(m.findAll([1, 2, 3])).toEqual([{ start: 1, end: 1, data: [2] }])
  })

  test('throws on zero alternatives', () => {
    expect(() => Pattern.oneOf<number>()).toThrow()
  })

  test('composable with followedBy and quantifiers', () => {
    // oneOf(even, odd)+ zero — one or more of either, then zero
    const m = Pattern.oneOf<number>(isEven, isOdd).oneOrMore().followedBy(isZero).compile()

    expect(m.findAll([1, 2, 3, 0])).toEqual([{ start: 0, end: 3, data: [1, 2, 3, 0] }])
  })

  test('nested inside followedBy', () => {
    // positive, then one of (even, negative, zero)
    const m = Pattern.where<number>(isPositive)
      .followedBy(Pattern.oneOf<number>(isEven, isNegative, isZero))
      .compile()

    expect(m.findAll([3, 4, 5, -1, 7, 0])).toEqual([
      { start: 0, end: 1, data: [3, 4] },
      { start: 2, end: 3, data: [5, -1] },
      { start: 4, end: 5, data: [7, 0] },
    ])
  })
})

describe('Nested pattern composition', () => {
  test('alternation as sub-pattern inside followedBy', () => {
    // positive (even | negative) zero
    const branch = Pattern.where<number>(isEven).or(isNegative)
    const m = Pattern.where<number>(isPositive).followedBy(branch).followedBy(isZero).compile()

    expect(m.findAll([3, 4, 0, 1, -2, 0])).toEqual([
      { start: 0, end: 2, data: [3, 4, 0] },
      { start: 3, end: 5, data: [1, -2, 0] },
    ])
  })

  test('quantified sub-pattern inside followedBy', () => {
    // even (odd+) even — even, then a sub-pattern "one or more odds", then even
    const odds = Pattern.where<number>(isOdd).oneOrMore()
    const m = Pattern.where<number>(isEven).followedBy(odds).followedBy(isEven).compile()

    expect(m.findAll([2, 3, 5, 7, 4])).toEqual([{ start: 0, end: 4, data: [2, 3, 5, 7, 4] }])
  })

  test('deeply nested: alternation of quantified sub-patterns', () => {
    // (even+ odd) | (odd+ even) — run of evens then odd, OR run of odds then even
    const m = Pattern.oneOf(
      Pattern.where<number>(isEven).oneOrMore().followedBy(isOdd),
      Pattern.where<number>(isOdd).oneOrMore().followedBy(isEven),
    ).compile()

    expect(m.findAll([2, 4, 3, 1, 5, 6])).toEqual([
      { start: 0, end: 2, data: [2, 4, 3] },
      { start: 3, end: 5, data: [1, 5, 6] },
    ])
  })

  test('sub-pattern reuse across multiple matchers', () => {
    const pair = Pattern.where<number>(isEven).followedBy(isOdd)

    const m1 = Pattern.where<number>(isPositive).followedBy(pair).compile()
    // Note: pair.oneOrMore() quantifies the LAST element (odd), giving even odd+
    const m2 = pair.oneOrMore().compile()

    // m1: positive (even odd)
    expect(m1.findAll([1, 2, 3])).toEqual([{ start: 0, end: 2, data: [1, 2, 3] }])

    // m2: even odd+ — even followed by one or more odds
    expect(m2.findAll([2, 3, 5, 4])).toEqual([{ start: 0, end: 2, data: [2, 3, 5] }])

    // Original pair pattern is unmodified — immutability holds
    const m3 = pair.compile()
    expect(m3.findAll([2, 3, 4, 5])).toEqual([
      { start: 0, end: 1, data: [2, 3] },
      { start: 2, end: 3, data: [4, 5] },
    ])
  })

  test('quantifying a multi-element sub-pattern via followedBy', () => {
    // To repeat a whole sub-pattern, pass it into followedBy — it becomes a single node
    const pair = Pattern.where<number>(isEven).followedBy(isOdd)
    // even, odd, then one or more (even, odd) pairs
    const m = Pattern.where<number>(isEven).followedBy(isOdd).followedBy(pair).oneOrMore().compile()

    expect(m.findAll([2, 3, 4, 5, 6, 7, 8])).toEqual([
      { start: 0, end: 5, data: [2, 3, 4, 5, 6, 7] },
    ])
  })

  test('oneOf inside oneOf (nested alternation)', () => {
    const small = Pattern.oneOf<number>(
      n => n === 1,
      n => n === 2,
    )
    const big = Pattern.oneOf<number>(
      n => n === 100,
      n => n === 200,
    )
    const m = Pattern.oneOf<number>(small, big).compile()

    expect(m.findAll([1, 50, 200, 2, 100])).toEqual([
      { start: 0, end: 0, data: [1] },
      { start: 2, end: 2, data: [200] },
      { start: 3, end: 3, data: [2] },
      { start: 4, end: 4, data: [100] },
    ])
  })
})

describe('Cross-predicate dependencies', () => {
  test('pre-processed pairs for adjacent comparison (increasing run)', () => {
    // Detect runs of 3+ strictly increasing numbers
    // Workaround: pre-process into pairs, then match on pairs
    const nums = [1, 3, 5, 2, 4, 8, 12, 7]
    const pairs = nums.slice(0, -1).map((n, i) => ({ value: n, next: nums[i + 1], index: i }))

    const m = Pattern.where<(typeof pairs)[number]>(p => p.next > p.value)
      .between(2, Infinity)
      .compile()

    const results = m.findAll(pairs)

    // Increasing runs: [1,3,5] at indices 0-2, [2,4,8,12] at indices 3-6
    expect(results).toEqual([
      { start: 0, end: 1, data: [pairs[0], pairs[1]] },
      { start: 3, end: 5, data: [pairs[3], pairs[4], pairs[5]] },
    ])
    // Map back to original values
    const runs = results.map(r => {
      const first = r.data[0].value
      const rest = r.data.map(p => p.next)
      return [first, ...rest]
    })
    expect(runs).toEqual([
      [1, 3, 5],
      [2, 4, 8, 12],
    ])
  })

  test('closure variable for stateful cross-predicate dependency', () => {
    // Scenario: match a "header" element, then one or more "body" elements whose
    // category matches the header. The body predicate depends on what the header was.
    interface Packet {
      type: 'header' | 'body'
      channel: string
    }

    const packets: Packet[] = [
      { type: 'header', channel: 'A' },
      { type: 'body', channel: 'A' },
      { type: 'body', channel: 'A' },
      { type: 'header', channel: 'B' },
      { type: 'body', channel: 'B' },
      { type: 'body', channel: 'A' }, // stray A body after B header
    ]

    // Use a closure variable that the header predicate sets
    let currentChannel = ''

    const m = Pattern.where<Packet>(p => {
      if (p.type === 'header') {
        currentChannel = p.channel
        return true
      }
      return false
    })
      .followedBy(
        Pattern.where<Packet>(p => p.type === 'body' && p.channel === currentChannel).oneOrMore(),
      )
      .compile()

    const results = m.findAll(packets)

    expect(results).toEqual([
      { start: 0, end: 2, data: [packets[0], packets[1], packets[2]] },
      { start: 3, end: 4, data: [packets[3], packets[4]] },
    ])
  })

  test('closure for arbitrarily old reference (match opening/closing tags)', () => {
    // Scenario: match open tag, any content, close tag where close matches the open.
    // The close predicate references the open tag captured much earlier.
    interface Tag {
      kind: 'open' | 'close' | 'text'
      name?: string
      content?: string
    }

    const tags: Tag[] = [
      { kind: 'open', name: 'div' },
      { kind: 'text', content: 'hello' },
      { kind: 'text', content: 'world' },
      { kind: 'close', name: 'div' },
      { kind: 'open', name: 'span' },
      { kind: 'text', content: 'x' },
      { kind: 'close', name: 'span' },
    ]

    let openName = ''

    const m = Pattern.where<Tag>(t => {
      if (t.kind === 'open') {
        openName = t.name!
        return true
      }
      return false
    })
      .followedBy(Pattern.where<Tag>(t => t.kind === 'text').oneOrMore())
      .followedBy((t: Tag) => t.kind === 'close' && t.name === openName)
      .compile()

    const results = m.findAll(tags)

    expect(results).toEqual([
      { start: 0, end: 3, data: [tags[0], tags[1], tags[2], tags[3]] },
      { start: 4, end: 6, data: [tags[4], tags[5], tags[6]] },
    ])
  })

  test('closure for running aggregate (cumulative sum threshold)', () => {
    // Scenario: find runs where the cumulative sum from the start of the run exceeds 10.
    // Each predicate invocation accumulates into a shared variable.
    const nums = [1, 2, 8, 1, 3, 3, 5, 2]

    // We need to reset the accumulator at each potential start position.
    // Strategy: wrap in a function that tries each start position.
    // This is where pre-processing is cleaner:
    const prefixSums: number[] = []
    let sum = 0
    for (const n of nums) {
      sum += n
      prefixSums.push(sum)
    }

    // Match 2+ consecutive elements whose sub-sum exceeds 10
    // Use pre-computed prefix sums, match on index-aware wrappers
    const indexed = nums.map((value, index) => ({ value, index }))

    let runStart = -1

    const m = Pattern.where<(typeof indexed)[number]>(el => {
      runStart = el.index
      return true
    })
      .followedBy(
        Pattern.where<(typeof indexed)[number]>(el => {
          const runSum = prefixSums[el.index] - (runStart > 0 ? prefixSums[runStart - 1] : 0)
          return runSum <= 10
        }).zeroOrMore(),
      )
      .followedBy((el: (typeof indexed)[number]) => {
        const runSum = prefixSums[el.index] - (runStart > 0 ? prefixSums[runStart - 1] : 0)
        return runSum > 10
      })
      .compile()

    const results = m.findAll(indexed)
    const runs = results.map(r => r.data.map(el => el.value))

    // From index 0: 1+2+8=11 > 10, match [1,2,8]
    // From index 3: 1+3+3+5=12 > 10, match [1,3,3,5]
    expect(runs).toEqual([
      [1, 2, 8],
      [1, 3, 3, 5],
    ])
  })

  test('pre-processing with windowed context', () => {
    // Scenario: detect when a value is a local maximum (greater than both neighbors).
    // Pre-process into triples, then match on the triple.
    const data = [1, 5, 3, 8, 2, 9, 4]
    const triples = data.slice(1, -1).map((v, i) => ({
      prev: data[i],
      value: v,
      next: data[i + 2],
      index: i + 1,
    }))

    const isLocalMax = (t: (typeof triples)[number]) => t.value > t.prev && t.value > t.next

    const m = Pattern.where<(typeof triples)[number]>(isLocalMax).compile()
    const peaks = m.findAll(triples).map(r => r.data[0].value)

    // Local maxima: 5 (1<5>3), 8 (3<8>2), 9 (2<9>4)
    expect(peaks).toEqual([5, 8, 9])
  })
})

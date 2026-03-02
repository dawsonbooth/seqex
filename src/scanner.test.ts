import { describe, expect, test } from 'bun:test'
import { Pattern } from './pattern'
import type { MatchResult } from './engine'
import { isEven, isNegative, isOdd, isPositive, isZero } from './test-predicates'

function collectAll<T>(
  matcher: ReturnType<typeof Pattern.prototype.compile>,
  sequence: T[],
): MatchResult<T>[] {
  const scanner = matcher.scanner()
  const results: MatchResult<T>[] = []
  for (const element of sequence) {
    results.push(...scanner.push(element))
  }
  results.push(...scanner.end())
  return results
}

describe('Scanner', () => {
  describe('equivalence with findAll', () => {
    test('single predicate', () => {
      const matcher = Pattern.where<number>(isEven).compile()
      const seq = [1, 2, 3, 4, 5, 6]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('multi-step pattern', () => {
      const matcher = Pattern.where<number>(isEven).followedBy(isOdd).followedBy(isEven).compile()
      const seq = [2, 3, 4, 6, 7, 8, 9, 10]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('oneOrMore quantifier', () => {
      const matcher = Pattern.where<number>(isEven).oneOrMore().compile()
      const seq = [2, 4, 1, 6, 8, 3]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('zeroOrMore with followedBy', () => {
      const matcher = Pattern.where<number>(isEven).zeroOrMore().followedBy(isOdd).compile()
      const seq = [2, 4, 3, 5, 6, 7]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('optional', () => {
      const matcher = Pattern.where<number>(isEven).optional().followedBy(isOdd).compile()
      const seq = [2, 3, 5, 4, 7]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('alternation', () => {
      const matcher = Pattern.where<number>(isPositive).or(isNegative).compile()
      const seq = [1, -2, 0, 3, -4]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('oneOf', () => {
      const matcher = Pattern.oneOf<number>(
        Pattern.where<number>(isEven).followedBy(isOdd),
        Pattern.where<number>(isOdd).followedBy(isEven),
      ).compile()
      const seq = [2, 3, 5, 4, 6]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('no matches', () => {
      const matcher = Pattern.where<number>(isNegative).compile()
      const seq = [1, 2, 3]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('adjacent matches', () => {
      const matcher = Pattern.where<number>(isEven).followedBy(isOdd).compile()
      const seq = [2, 3, 4, 5, 6, 7]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('between quantifier', () => {
      const matcher = Pattern.where<number>(isEven).between(2, 4).compile()
      const seq = [2, 4, 6, 8, 10, 1]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('times quantifier', () => {
      const matcher = Pattern.where<number>(isEven).times(3).compile()
      const seq = [2, 4, 6, 8, 1, 2, 4, 6]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('multiple quantifier types combined', () => {
      const matcher = Pattern.where<number>(isEven)
        .times(2)
        .followedBy(isOdd)
        .oneOrMore()
        .followedBy(isZero)
        .optional()
        .followedBy(isNegative)
        .compile()
      const seq = [2, 4, 3, 5, 0, -1, 2, 4, 3, -1]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('between(0, max) quantifier', () => {
      const matcher = Pattern.where<number>(isEven).between(0, 2).followedBy(isOdd).compile()
      const seq = [3, 2, 3, 2, 4, 3]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('complex: quantifier + alternation', () => {
      const matcher = Pattern.where<number>(isPositive)
        .or(Pattern.where<number>(isNegative))
        .oneOrMore()
        .followedBy(isZero)
        .compile()
      const seq = [1, -2, 3, 0, 5, 0]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('wildcard patterns', () => {
      const matcher = Pattern.where<number>(isEven).followedByAny().followedBy(isOdd).compile()
      const seq = [2, 99, 3, 4, 0, 5]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('generic types: strings', () => {
      const matcher = Pattern.where<string>(s => s.startsWith('a'))
        .followedBy(s => s.length > 3)
        .compile()
      const seq = ['apple', 'banana', 'ant', 'elephant']

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })
  })

  describe('anchors', () => {
    test('atStart works in streaming', () => {
      const matcher = Pattern.where<number>(isEven).atStart().compile()
      const seq = [2, 3, 4]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('atStart fails when first element does not match', () => {
      const matcher = Pattern.where<number>(isEven).atStart().compile()
      const seq = [1, 2, 4]

      expect(collectAll(matcher, seq)).toEqual([])
    })

    test('atEnd emits only from end()', () => {
      const matcher = Pattern.where<number>(isEven).atEnd().compile()
      const scanner = matcher.scanner()

      // Push all elements — nothing should emit yet for atEnd patterns
      const pushResults: MatchResult<number>[] = []
      for (const n of [1, 3, 4]) {
        pushResults.push(...scanner.push(n))
      }

      const endResults = scanner.end()

      expect(pushResults).toEqual([])
      expect(endResults).toEqual([{ start: 2, end: 2, data: [4] }])
    })

    test('atEnd fails when last element does not match', () => {
      const matcher = Pattern.where<number>(isEven).atEnd().compile()
      const seq = [2, 4, 3]

      expect(collectAll(matcher, seq)).toEqual([])
    })

    test('atStart + atEnd', () => {
      const matcher = Pattern.where<number>(isEven).oneOrMore().atStart().atEnd().compile()

      expect(collectAll(matcher, [2, 4, 6])).toEqual(matcher.findAll([2, 4, 6]))
      expect(collectAll(matcher, [2, 4, 3])).toEqual([])
      expect(collectAll(matcher, [1, 2, 4])).toEqual([])
    })
  })

  describe('greedy vs lazy', () => {
    test('greedy: matches only emit when simulation dies', () => {
      const matcher = Pattern.where<number>(isEven).oneOrMore().followedBy(isOdd).compile()
      const scanner = matcher.scanner()

      const r1 = scanner.push(2)
      const r2 = scanner.push(4)
      const r3 = scanner.push(6)
      // Simulation still alive — evens keep matching the loop
      expect(r1).toEqual([])
      expect(r2).toEqual([])
      expect(r3).toEqual([])

      // Odd kills the even loop, match completes
      const r4 = scanner.push(3)
      const r5 = scanner.end()

      expect([...r4, ...r5]).toEqual([{ start: 0, end: 3, data: [2, 4, 6, 3] }])
    })

    test('lazy: matches emit as early as possible', () => {
      const matcher = Pattern.where<number>(isPositive)
        .oneOrMore(false)
        .followedBy(isPositive)
        .compile()
      const scanner = matcher.scanner()

      // Lazy: match [1, 2] as soon as possible
      const results: MatchResult<number>[] = []
      for (const n of [1, 2, 3]) {
        results.push(...scanner.push(n))
      }
      results.push(...scanner.end())

      expect(results).toEqual(matcher.findAll([1, 2, 3]))
    })

    test('lazy equivalence', () => {
      const matcher = Pattern.where<number>(isEven).zeroOrMore(false).followedBy(isEven).compile()
      const seq = [2, 4, 6]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })
  })

  describe('edge cases', () => {
    test('empty stream', () => {
      const matcher = Pattern.where<number>(isEven).compile()
      const scanner = matcher.scanner()

      expect(scanner.end()).toEqual([])
    })

    test('single element match', () => {
      const matcher = Pattern.where<number>(isEven).compile()
      const seq = [2]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('single element no match', () => {
      const matcher = Pattern.where<number>(isEven).compile()
      const seq = [1]

      expect(collectAll(matcher, seq)).toEqual([])
    })

    test('all elements match individually', () => {
      const matcher = Pattern.where<number>(isPositive).compile()
      const seq = [1, 2, 3, 4, 5]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('match at end of stream', () => {
      const matcher = Pattern.where<number>(isEven).followedBy(isOdd).compile()
      const seq = [1, 2, 3]

      expect(collectAll(matcher, seq)).toEqual(matcher.findAll(seq))
    })

    test('pathological pattern does not hang', () => {
      const matcher = Pattern.where<number>(isPositive)
        .oneOrMore()
        .followedBy(Pattern.where<number>(isPositive).oneOrMore())
        .followedBy(Pattern.where<number>(isPositive).oneOrMore())
        .followedBy(n => n === 0)
        .compile()

      const seq = Array.from({ length: 50 }, () => 1).concat([0])
      const start = performance.now()
      const results = collectAll(matcher, seq)
      const elapsed = performance.now() - start

      expect(results).toHaveLength(1)
      expect(elapsed).toBeLessThan(1000)
    })
  })

  describe('cross-predicate dependencies', () => {
    test('closure variables work with scanner', () => {
      let currentChannel = ''

      interface Packet {
        type: 'header' | 'body'
        channel: string
      }

      const matcher = Pattern.where<Packet>(p => {
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

      const packets: Packet[] = [
        { type: 'header', channel: 'A' },
        { type: 'body', channel: 'A' },
        { type: 'body', channel: 'A' },
        { type: 'header', channel: 'B' },
        { type: 'body', channel: 'B' },
      ]

      expect(collectAll(matcher, packets)).toEqual(matcher.findAll(packets))
    })
  })
})

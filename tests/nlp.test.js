const NLPEngine = require('../src/nlp/NLPEngine');
const { topKeywords } = require('../src/nlp/keywords');

const engine = new NLPEngine();

describe('classification', () => {
  test('clearly positive text is Happy', () => {
    const result = engine.classify(
      'I absolutely love this dress, it is beautiful and fits perfectly!'
    );
    expect(result.label).toBe('Happy');
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('clearly negative text is Angry', () => {
    const result = engine.classify(
      'Terrible quality, awful fit, complete waste of money. Horrible!'
    );
    expect(result.label).toBe('Angry');
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('flat factual text is Neutral', () => {
    const result = engine.classify('The dress is made of cotton.');
    expect(result.label).toBe('Neutral');
  });

  test('emoticons are treated as signal', () => {
    expect(engine.classify('I love this dress :)').label).toBe('Happy');
    expect(engine.classify('Really disappointed with this :(').label).toBe('Angry');
  });

  test('ALL-CAPS and !!! raise intensity', () => {
    const calm = engine.analyse('This is good').compound;
    const loud = engine.analyse('This is GOOD!!!').compound;
    expect(loud).toBeGreaterThan(calm);
  });

  test('empty and whitespace-only text does not throw and is Neutral with zero confidence', () => {
    for (const text of ['', '   ', null, undefined]) {
      const result = engine.classify(text);
      expect(result.label).toBe('Neutral');
      expect(result.confidence).toBe(0);
      expect(result.compound).toBe(0);
    }
  });

  test('confidence is always within [0, 1]', () => {
    const samples = [
      'amazing wonderful perfect',
      'disgusting horrible awful',
      'the item arrived on tuesday',
      '',
      'ok',
    ];
    for (const text of samples) {
      const { confidence } = engine.classify(text);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('preprocessing', () => {
  test('cleaned keeps punctuation, capitalisation and emoticons', () => {
    const { cleaned } = engine.preprocess('  LOVE this!!!  it\u2019s great :)  ');
    expect(cleaned).toBe("LOVE this!!! it's great :)");
  });

  test('tokens drop stop words, punctuation, digits and contraction fragments', () => {
    const { tokens } = engine.preprocess(
      "This dress isn't really lovely and it was made of cotton in 2024, check http://x.com ok"
    );
    for (const stop of ['this', 'is', 'and', 'it', 'was', 'of', 'in', 'isn', 'does', 'the']) {
      expect(tokens).not.toContain(stop);
    }
    expect(tokens).toContain('dress');
    expect(tokens).toContain('lovely');
    expect(tokens).toContain('cotton');
    expect(tokens).not.toContain('http');
    expect(tokens).not.toContain('2024');
  });

  test('tokens exclude words shorter than the minimum length', () => {
    const { tokens } = engine.preprocess('I am a big fan');
    expect(tokens).not.toContain('i');
    expect(tokens).not.toContain('am');
    expect(tokens).toContain('big');
    expect(tokens).toContain('fan');
  });
});

describe('keywords', () => {
  test('counts each word at most once per review (document frequency)', () => {
    const result = topKeywords(['bad fit bad bad', 'bad quality'], 5);
    expect(result[0]).toEqual({ word: 'bad', count: 2 });
    expect(result.find((k) => k.word === 'fit')).toEqual({ word: 'fit', count: 1 });
  });

  test('respects the requested limit and breaks ties alphabetically', () => {
    const result = topKeywords(['alpha beta beta gamma gamma gamma'], 2);
    expect(result).toEqual([
      { word: 'alpha', count: 1 },
      { word: 'beta', count: 1 },
    ]);
  });
});

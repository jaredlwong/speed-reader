/**
 * Given a list of sentence lengths, a words-per-minute rate, and a pause time between sentences,
 * this function calculates the time in milliseconds to spend on each sentence.
 *
 * Overall we will read at the specified words-per-minute rate, but we will pause between sentences.
 * Therefore, when reading, we will actually read slightly faster than the specified
 * words-per-minute rate.
 *
 * @param sentenceLengths an array of numbers representing the number of words in each sentence
 * @param wpm a number representing the words-per-minute rate
 * @param pauseTime a number representing the pause time in milliseconds between sentences
 * @returns an array of numbers representing the time in milliseconds to spend on each sentence
 */
export function sentenceTimes(sentenceLengths: number[], wpm: number, pauseTime: number): number[] {
  const totalWords = sentenceLengths.reduce((a, b) => a + b);
  const totalTime = (totalWords / wpm) * 60 * 1000 - pauseTime * sentenceLengths.length;
  const sentenceTimes: number[] = [];
  for (const length of sentenceLengths) {
    const sentenceTime = (length / totalWords) * totalTime;
    sentenceTimes.push(sentenceTime);
  }
  return sentenceTimes;
}

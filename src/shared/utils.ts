export function convertToHumanReadable(timeInMilliseconds: number): string {
  const timeInSeconds = timeInMilliseconds / 1000;
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  console.log(
    `timeInMilliseconds: ${timeInMilliseconds} timeInSeconds: ${timeInSeconds} hours: ${hours} minutes: ${minutes} seconds: ${seconds}`,
  );

  let humanReadable = "";
  if (hours > 0) {
    humanReadable += hours + ":";
  }
  if (minutes < 10) {
    humanReadable += "0";
  }
  humanReadable += minutes + ":";
  if (seconds < 10) {
    humanReadable += "0";
  }
  humanReadable += seconds;

  return humanReadable;
}

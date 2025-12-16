// Coverage collection storage - shared between fixtures and global teardown
const coverageData = [];

export function addCoverageData(coverage) {
  if (coverage && Array.isArray(coverage) && coverage.length > 0) {
    coverageData.push(...coverage);
  }
}

export function getCoverageData() {
  return coverageData;
}

export function clearCoverageData() {
  coverageData.length = 0;
}



import { ElasticResult } from '../types';

/**
 * Reciprocal Rank Fusion (RRF) is a method for combining multiple result sets
 * into a single result set. It is a simple and effective way to combine results
 * from different search engines or search methods.
 *
 * @param searchResults An array of search result sets from different sources.
 * @param k A constant that determines how much to penalize lower-ranked results.
 * @returns A single, fused result set, sorted by RRF score.
 */
export const reciprocalRankFusion = (
  searchResults: ElasticResult[][],
  k = 60
): ElasticResult[] => {
  const scores: { [id: string]: number } = {};
  const fusedResults: { [id: string]: ElasticResult } = {};

  for (const results of searchResults) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const rank = i + 1;
      const score = 1 / (k + rank);

      if (scores[result.source.id]) {
        scores[result.source.id] += score;
      } else {
        scores[result.source.id] = score;
        fusedResults[result.source.id] = result;
      }
    }
  }

  const finalResults = Object.values(fusedResults).sort((a, b) => {
    return scores[b.source.id] - scores[a.source.id];
  });

  return finalResults;
};

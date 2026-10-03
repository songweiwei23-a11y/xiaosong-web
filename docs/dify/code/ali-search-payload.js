function main({ query }) {
  return {
    body: JSON.stringify({
      query: String(query || '').slice(0, 6000),
      query_rewrite: false,
      top_k: 6,
      content_type: 'mainText',
      way: 'lite',
    }),
  };
}

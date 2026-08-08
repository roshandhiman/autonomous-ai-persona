export interface Topic {
  title: string;
  url: string;
  points: number;
}

export async function fetchTopics(domain: string): Promise<Topic[]> {
  // Calculate timestamp for 24 hours ago
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  
  // Format the Algolia HN search API URL
  const query = encodeURIComponent(domain);
  const url = `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&numericFilters=created_at_i>${twentyFourHoursAgo}`;
  
  try {
    const response = await fetch(url, {
      cache: 'no-store' // Always fetch fresh — never cache between tick runs
    });

    if (!response.ok) {
      console.error(`Failed to fetch topics for domain ${domain}. Status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Map the HN hits to our simplified Topic interface
    const topics: Topic[] = data.hits.map((hit: any) => ({
      title: hit.title,
      url: hit.url,
      points: hit.points || 0
    }));

    // Filter out posts that might not have a URL (e.g. Ask HN or Show HN without links) 
    // depending on if you want external links only. We'll allow all for now.
    return topics.filter(t => t.title); 
  } catch (error) {
    console.error('Error fetching topics from Hacker News:', error);
    return [];
  }
}

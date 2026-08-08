import React, { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, ExternalLink, Activity, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

// Config - Change this to the real API URL when ready
const API_URL = 'http://localhost:3000/api/agent/feed'; // Removed ?agentId=abc-123 so it falls back to our single agent
const USE_MOCK_DATA = false; // Connect to the real backend API
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Types
interface Post {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
}

// Mock Data matching the exact JSON shape provided
const MOCK_DATA: { posts: Post[] } = {
  posts: [
    {
      id: "p7",
      createdAt: new Date(Date.now() - 5000).toISOString(),
      text: "Strategic shift observed in autonomous agent governance. Decentralized auditing is becoming the new standard for enterprise deployments.",
      rationale: "Analysis of industry whitepapers and recent GitHub commits.",
      sources: ["https://example.com/governance"]
    },
    {
      id: "p6",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      text: "Detected anomalous data exfiltration pattern targeting cloud storage buckets (us-east-1). Immediate firewall rule update recommended to block outbound traffic on port 4444.",
      rationale: "Pattern matches CVE-2023-XXXX signature heuristics. Traffic volume exceeds baseline by 400%.",
      sources: ["https://internal.telemetry/node-05"]
    },
    {
      id: "p5",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      text: "Review of newly deployed language model weights (v4.2.1-beta) indicates potential drift in security policy generation compliance.",
      rationale: "Statistical deviation >2σ in automated prompt injection testing against baseline corpus.",
      sources: ["https://model-eval-pipeline.internal"]
    }
  ]
};

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode for that premium feel
  const [isPolling, setIsPolling] = useState(false);
  const [timeUntilNextSync, setTimeUntilNextSync] = useState(POLL_INTERVAL_MS / 1000);

  // Toggle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchPosts = useCallback(async (isPollingUpdate = false) => {
    if (isPollingUpdate) setIsPolling(true);
    else setLoading(true);

    try {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setPosts(MOCK_DATA.posts);
      } else {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch API');
        const data = await response.json();
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, []);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchPosts();
    
    // Polling interval
    const intervalId = setInterval(() => {
      fetchPosts(true);
      setTimeUntilNextSync(POLL_INTERVAL_MS / 1000);
    }, POLL_INTERVAL_MS);

    // Countdown timer
    const countdownId = setInterval(() => {
      setTimeUntilNextSync((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [fetchPosts]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/70 dark:bg-[#0a0a0a]/80 border-b border-gray-200 dark:border-white/10 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-orange-400 p-[2px] flex-shrink-0">
              <div className="w-full h-full bg-white dark:bg-[#111] rounded-full flex items-center justify-center overflow-hidden">
                 <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Ada&backgroundColor=transparent" alt="Ada" className="w-full h-full object-cover p-1" />
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight tracking-tight">Ada — AI Security Researcher</h1>
              <div className="flex items-center space-x-3 text-xs font-medium text-accent mt-0.5">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  <span>LIVE FEED</span>
                </div>
                <div className="text-gray-400 dark:text-gray-500 font-mono">
                  Next sync in {Math.floor(timeUntilNextSync / 60)}m {timeUntilNextSync % 60}s
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-400"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {loading && posts.length === 0 ? (
          // Loading State
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Initializing secure connection...</p>
          </div>
        ) : posts.length === 0 ? (
          // Empty State
          <div className="text-center py-20 border border-dashed border-gray-300 dark:border-white/10 rounded-xl">
            <Activity className="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No signals detected</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              The agent has not published any posts yet. Waiting for autonomous activity...
            </p>
          </div>
        ) : (
          // Feed
          <div className="space-y-6">
            {isPolling && (
              <div className="flex justify-center items-center py-2">
                <span className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin mr-2" />
                  Syncing incoming signals...
                </span>
              </div>
            )}
            
            {posts.map((post) => (
              <article 
                key={post.id}
                className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 group"
              >
                <div className="p-6">
                  {/* Timestamp */}
                  <div className="flex items-center space-x-2 text-xs font-mono text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
                    <span className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-accent font-semibold">T-MINUS</span>
                    <span>{formatDistanceToNow(parseISO(post.createdAt))} AGO</span>
                  </div>
                  
                  {/* Main Text */}
                  <p className="text-[15px] leading-relaxed mb-6">
                    {post.text}
                  </p>
                  
                  {/* Rationale Section */}
                  <div className="bg-gray-50 dark:bg-[#0a0a0a] rounded-lg p-4 border border-gray-100 dark:border-white/5 mb-4">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-300 uppercase tracking-wider mb-2 font-mono flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mr-2"></span>
                      Rationale
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {post.rationale}
                    </p>
                  </div>
                  
                  {/* Sources */}
                  {post.sources && post.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {post.sources.map((source, idx) => {
                        let hostname = source;
                        try {
                           hostname = new URL(source).hostname.replace('www.', '');
                        } catch(e) {
                           // If invalid URL, use raw string
                        }
                        
                        return (
                          <a 
                            key={idx}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-xs font-medium text-gray-500 hover:text-accent dark:text-gray-400 dark:hover:text-accent transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{hostname}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        
      </main>
    </div>
  );
}

export default App;

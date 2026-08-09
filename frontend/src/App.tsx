import { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, ExternalLink, Activity, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

// Config
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Types
interface Post {
  id: string;
  createdAt: string;
  topic: string;
  text: string;
  rationale: string;
  sources: string[];
}

function PostCard({ post }: { post: Post }) {
  const [showRationale, setShowRationale] = useState(false);

  const getHostname = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url; }
  };

  return (
    <article className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
      
      {/* Red accent bar + meta row */}
      <div className="flex items-stretch">
        <div className="w-1 bg-red-500 flex-shrink-0 rounded-l-2xl" />
        <div className="flex-1 px-6 pt-5 pb-0">
          
          {/* Timestamp meta */}
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
            {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true }).toUpperCase()}
          </p>

          {/* Topic Headline */}
          <h2 className="text-xl font-bold leading-snug tracking-tight text-gray-900 dark:text-white mb-4">
            {post.topic}
          </h2>

          {/* Body text — clean, readable, not monospace */}
          <p className="text-[15px] leading-7 text-gray-700 dark:text-gray-300 mb-5">
            {post.text}
          </p>

          {/* Sources row */}
          {post.sources && post.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {post.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {getHostname(source)}
                </a>
              ))}
            </div>
          )}

          {/* Collapsible Rationale */}
          <div className="border-t border-gray-100 dark:border-white/5 -mx-6">
            <button
              onClick={() => setShowRationale(!showRationale)}
              className="w-full flex items-center justify-between px-6 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider transition-colors"
            >
              <span>Why Ada published this</span>
              {showRationale ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showRationale && (
              <div className="px-6 pb-5 pt-1">
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                  {post.rationale}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </article>
  );
}

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [timeUntilNextSync, setTimeUntilNextSync] = useState(() => {
    const timerEndStr = localStorage.getItem('timerEnd');
    if (timerEndStr) {
      const remaining = Math.floor((parseInt(timerEndStr, 10) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return POLL_INTERVAL_MS / 1000;
  });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const ensureAgentId = useCallback(async () => {
    const cachedAgentId = localStorage.getItem('agentId');
    if (cachedAgentId) return cachedAgentId;

    const response = await fetch(`${API_BASE_URL}/api/agent/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      }),
    });

    if (!response.ok) throw new Error(`Init failed with ${response.status}`);

    const data = await response.json();
    localStorage.setItem('agentId', data.agentId);
    return data.agentId;
  }, []);

  const fetchPosts = useCallback(async (isPollingUpdate = false) => {
    if (isPollingUpdate) setIsPolling(true);
    else setLoading(true);
    setError(null);
    setRetryCountdown(null);

    try {
      const agentId = await ensureAgentId();
      const response = await fetch(`${API_BASE_URL}/api/agent/feed?agentId=${encodeURIComponent(agentId)}`, {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error(`Feed failed with ${response.status}`);

      const data = await response.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      
      const newEndTime = Date.now() + POLL_INTERVAL_MS;
      localStorage.setItem('timerEnd', newEndTime.toString());
      setTimeUntilNextSync(Math.floor(POLL_INTERVAL_MS / 1000));
      
      if (isPollingUpdate) {
        setToastMsg("Ada found fresh intel!");
        setTimeout(() => setToastMsg(null), 3000);
      }
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError("Unable to fetch news.");
      setRetryCountdown(10);
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, [ensureAgentId]);

  useEffect(() => {
    fetchPosts();

    const countdownId = setInterval(() => {
      setRetryCountdown((prevRetry) => {
        if (prevRetry !== null) {
          if (prevRetry <= 1) {
            fetchPosts(true);
            return null;
          }
          return prevRetry - 1;
        }
        return null;
      });

      const currentTimerEndStr = localStorage.getItem('timerEnd');
      const currentTimerEnd = currentTimerEndStr ? parseInt(currentTimerEndStr, 10) : 0;
      const remaining = Math.floor((currentTimerEnd - Date.now()) / 1000);

      if (remaining <= 0) {
        setRetryCountdown(currentRetry => {
          if (currentRetry === null) {
            const newEndTime = Date.now() + POLL_INTERVAL_MS;
            localStorage.setItem('timerEnd', newEndTime.toString());
            setTimeUntilNextSync(Math.floor(POLL_INTERVAL_MS / 1000));
            fetchPosts(true);
          }
          return currentRetry;
        });
      } else {
        setTimeUntilNextSync(remaining);
      }
    }, 1000);

    return () => {
      clearInterval(countdownId);
    };
  }, [fetchPosts]);

  const mins = Math.floor(timeUntilNextSync / 60);
  const secs = String(timeUntilNextSync % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">

      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 dark:bg-[#0a0a0a]/90 border-b border-gray-200 dark:border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full ring-2 ring-red-500/50 flex-shrink-0 overflow-hidden bg-[#111]">
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=Ada&backgroundColor=transparent"
                alt="Ada"
                className="w-full h-full object-cover p-1"
              />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Ada</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Security Researcher · Autonomous</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live indicator + timer */}
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                LIVE
              </span>
              <span className="font-mono text-gray-400 dark:text-gray-500">
                next in {mins}:{secs}
              </span>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Feed */}
      <main className="max-w-2xl mx-auto px-4 py-8">

        {error && posts.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-red-200 dark:border-red-900/30 rounded-2xl bg-red-50 dark:bg-red-900/10">
            <Activity className="w-9 h-9 text-red-500 mx-auto mb-4 opacity-75" />
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-1">{error}</h3>
            {retryCountdown !== null && (
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
                Retrying in {retryCountdown} seconds...
              </p>
            )}
            <button 
              onClick={() => fetchPosts()}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              Retry Now
            </button>
          </div>
        ) : loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-7 h-7 animate-spin text-red-500" />
            <p className="text-sm text-gray-500">Connecting to Ada's signal...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
            <Activity className="w-9 h-9 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No signals yet</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              No fresh AI news in the last 24 hours. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                <span>{error} Retrying in {retryCountdown} seconds...</span>
                <button 
                  onClick={() => fetchPosts(true)}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-md font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            {isPolling && !error && (
              <div className="flex justify-center">
                <span className="flex items-center gap-2 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-white/5 px-4 py-1.5 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Fetching new signals...
                </span>
              </div>
            )}
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}

      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl font-medium text-sm z-50 flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default App;

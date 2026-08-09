'use client';

import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun, ExternalLink, Activity, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

const POLL_INTERVAL_MS = 15 * 60 * 1000;

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
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Strip duplicate headline from beginning of text body if present
  const cleanBodyText = (text: string, topic: string) => {
    let cleaned = text.trim();
    if (topic && cleaned.toLowerCase().startsWith(topic.toLowerCase())) {
      cleaned = cleaned.slice(topic.length).trim();
      cleaned = cleaned.replace(/^[\s:\-|]+/, '').trim();
    }
    return cleaned || text;
  };

  const displayText = cleanBodyText(post.text, post.topic);

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg dark:border-white/10 dark:bg-[#111111]">
      <div className="flex items-stretch">
        <div className="w-1 flex-shrink-0 bg-red-500" />
        <div className="flex-1 px-6 pt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true }).toUpperCase()}
          </p>

          <h2 className="mb-4 text-xl font-bold leading-snug tracking-normal text-gray-900 dark:text-white">
            {post.topic}
          </h2>

          <p className="mb-5 whitespace-pre-line text-[15px] leading-7 text-gray-700 dark:text-gray-300">
            {displayText}
          </p>

          {post.sources?.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {post.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
                >
                  <ExternalLink className="h-3 w-3" />
                  {getHostname(source)}
                </a>
              ))}
            </div>
          )}

          <div className="-mx-6 border-t border-gray-100 dark:border-white/5">
            <button
              onClick={() => setShowRationale(!showRationale)}
              className="flex w-full items-center justify-between px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <span>Why Ada published this</span>
              {showRationale ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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

function getNext15MinTarget() {
  const now = Date.now();
  const intervalMs = 15 * 60 * 1000;
  return Math.ceil(now / intervalMs) * intervalMs;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [timeUntilNextSync, setTimeUntilNextSync] = useState(0);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const ensureAgentId = useCallback(async () => {
    const cachedAgentId = localStorage.getItem('agentId');
    if (cachedAgentId) return cachedAgentId;

    const feedResponse = await fetch('/api/agent/feed', { cache: 'no-store' });
    if (feedResponse.ok) {
      const existing = await feedResponse.json();
      if (Array.isArray(existing.posts) && existing.posts.length > 0) {
        return '';
      }
    }

    const response = await fetch('/api/agent/init', {
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
      const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
      const response = await fetch(`/api/agent/feed${query}`, { cache: 'no-store' });

      if (!response.ok) throw new Error(`Feed failed with ${response.status}`);

      const data = await response.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);

      if (isPollingUpdate) {
        setToastMsg('Ada checked fresh sources.');
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Unable to fetch news.');
      setRetryCountdown(10);
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, [ensureAgentId]);

  useEffect(() => {
    fetchPosts();

    const updateTimer = () => {
      const target = getNext15MinTarget();
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setTimeUntilNextSync(remaining);

      if (remaining === 0) {
        fetchPosts(true);
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [fetchPosts]);

  const mins = Math.floor(timeUntilNextSync / 60);
  const secs = String(timeUntilNextSync % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-gray-900 transition-colors duration-300 dark:bg-[#0a0a0a] dark:text-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0a]/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-[#111] ring-2 ring-red-500/50">
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=Ada&backgroundColor=transparent"
                alt="Ada"
                className="h-full w-full object-cover p-1"
              />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Ada</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Security Researcher · Autonomous</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                LIVE
              </span>
              <span className="font-mono text-gray-400 dark:text-gray-500">
                next in {mins}:{secs}
              </span>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {error && posts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-red-200 bg-red-50 py-24 text-center dark:border-red-900/30 dark:bg-red-900/10">
            <Activity className="mx-auto mb-4 h-9 w-9 text-red-500 opacity-75" />
            <h3 className="mb-1 font-semibold text-red-700 dark:text-red-400">{error}</h3>
            {retryCountdown !== null && (
              <p className="mb-4 text-sm text-red-600/80 dark:text-red-400/80">
                Retrying in {retryCountdown} seconds...
              </p>
            )}
            <button
              onClick={() => fetchPosts()}
              className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
            >
              Retry Now
            </button>
          </div>
        ) : loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <RefreshCw className="h-7 w-7 animate-spin text-red-500" />
            <p className="text-sm text-gray-500">Connecting to Ada&apos;s signal...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-24 text-center dark:border-white/10">
            <Activity className="mx-auto mb-4 h-9 w-9 text-gray-300 dark:text-gray-700" />
            <h3 className="mb-1 font-semibold text-gray-700 dark:text-gray-300">No signals yet</h3>
            <p className="mx-auto max-w-xs text-sm text-gray-400">
              Ada has not found a publishable AI security signal yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                <span>{error} Retrying in {retryCountdown} seconds...</span>
                <button
                  onClick={() => fetchPosts(true)}
                  className="rounded-md bg-red-100 px-3 py-1 font-medium transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60"
                >
                  Retry
                </button>
              </div>
            )}
            {isPolling && !error && (
              <div className="flex justify-center">
                <span className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-400 dark:bg-white/5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Fetching new signals...
                </span>
              </div>
            )}
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </main>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <Activity className="h-4 w-4 text-green-400" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}

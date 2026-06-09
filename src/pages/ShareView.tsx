import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  ArrowUpDown,
  Calendar,
  ArrowDownZA,
  ArrowUpAZ,
  X,
  Lock,
  AlertTriangle,
  Loader2,
  Eye,
  Clock,
  Home,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import type { SharePayload, SharedIconItem } from '@/types';
import {
  parseShareLink,
  getShareDataFromHash,
  formatExpireRemaining,
} from '@/services/share';
import { formatDate } from '@/utils';

type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

export default function ShareView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [shareData, setShareData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [previewIcon, setPreviewIcon] = useState<SharedIconItem | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    const data = getShareDataFromHash();
    if (!data) {
      setErrorMsg('无效的分享链接，缺少数据参数');
      setIsLoading(false);
      return;
    }
    setShareData(data);
    (async () => {
      try {
        const result = await parseShareLink(data);
        if (result.valid && result.payload) {
          setPayload(result.payload);
        } else if (result.needPassword) {
          setNeedPassword(true);
        } else if (result.expired) {
          setIsExpired(true);
          setErrorMsg(result.error || '分享链接已过期');
        } else {
          setErrorMsg(result.error || '无法解析分享链接');
        }
      } catch {
        setErrorMsg('解析分享链接时发生错误');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleVerifyPassword = async () => {
    if (!shareData || !password.trim()) return;
    setIsVerifying(true);
    try {
      const result = await parseShareLink(shareData, password);
      if (result.valid && result.payload) {
        setPayload(result.payload);
        setNeedPassword(false);
        toast.showSuccess('密码验证成功');
      } else if (result.expired) {
        setIsExpired(true);
        setNeedPassword(false);
        setErrorMsg(result.error || '分享链接已过期');
      } else {
        toast.showError(result.error || '密码错误');
      }
    } catch {
      toast.showError('验证失败');
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredAndSortedIcons = useMemo(() => {
    if (!payload) return [];
    let list = [...payload.icons];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    switch (sortMode) {
      case 'date-desc':
        list.sort((a, b) => b.addedAt - a.addedAt);
        break;
      case 'date-asc':
        list.sort((a, b) => a.addedAt - b.addedAt);
        break;
      case 'name-asc':
        list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        break;
      case 'name-desc':
        list.sort((a, b) => b.name.localeCompare(a.name, 'zh'));
        break;
    }
    return list;
  }, [payload, searchQuery, sortMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && needPassword) {
      handleVerifyPassword();
    }
  };

  const handleBackdropClose = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setPreviewIcon(null);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIcon(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const sortLabel = useMemo(() => {
    const map: Record<SortMode, string> = {
      'date-desc': '时间从新到旧',
      'date-asc': '时间从旧到新',
      'name-asc': '名称 A→Z',
      'name-desc': '名称 Z→A',
    };
    return map[sortMode];
  }, [sortMode]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-ink-950 bg-grid bg-radial-glow">
        <Loader2 className="w-8 h-8 animate-spin text-neon-cyan mb-3" />
        <div className="text-sm text-slate-400">正在加载分享内容...</div>
      </div>
    );
  }

  if (errorMsg && !needPassword) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-ink-950 bg-grid bg-radial-glow p-6">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
          {isExpired ? (
            <Clock className="w-10 h-10 text-rose-400" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-rose-400" />
          )}
        </div>
        <div className="text-xl font-semibold text-white mb-2">
          {isExpired ? '分享已过期' : '无法访问分享'}
        </div>
        <div className="text-sm text-slate-500 text-center max-w-md mb-6">{errorMsg}</div>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          <Home className="w-4 h-4" />
          返回首页
        </button>
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-ink-950 bg-grid bg-radial-glow p-6">
        <div className="w-20 h-20 rounded-full bg-neon-amber/10 border border-neon-amber/30 flex items-center justify-center mb-5">
          <Lock className="w-10 h-10 text-neon-amber" />
        </div>
        <div className="text-xl font-semibold text-white mb-2">需要访问密码</div>
        <div className="text-sm text-slate-500 text-center max-w-md mb-6">
          此分享内容已被密码保护，请输入密码查看
        </div>
        <div className="w-full max-w-sm card p-5">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入访问密码"
            className="input mb-4"
            autoFocus
          />
          <button
            onClick={handleVerifyPassword}
            disabled={isVerifying || !password.trim()}
            className="btn btn-primary w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                验证中...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                解锁查看
              </>
            )}
          </button>
        </div>
        <button onClick={() => navigate('/')} className="btn-ghost btn mt-4 text-sm">
          <Home className="w-3.5 h-3.5" />
          返回首页
        </button>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-ink-950 bg-grid bg-radial-glow overflow-hidden">
      <header className="shrink-0 px-6 py-4 border-b border-ink-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-amber flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-ink-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              {payload.projectName}
              <span className="chip bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 text-[10px] font-normal">
                只读分享
              </span>
            </h1>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {payload.icons.length} 个图标
              </span>
              {payload.config.expiresAt && (
                <span className="flex items-center gap-1 text-neon-amber/80">
                  <Clock className="w-3 h-3" />
                  剩余 {formatExpireRemaining(payload.config.expiresAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="btn btn-secondary">
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </header>

      {payload.projectDescription && (
        <div className="px-6 py-3 border-b border-ink-700/30 text-sm text-slate-400 bg-ink-900/30">
          {payload.projectDescription}
        </div>
      )}

      <div className="px-4 py-3 border-b border-ink-700/50 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索图标名称..."
            className="input pl-9 text-sm"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSortMenu((v) => !v)}
            className="btn btn-secondary !py-1.5 text-xs flex items-center gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortLabel}
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-ink-800 border border-ink-600 rounded-lg shadow-xl overflow-hidden z-20 min-w-[140px]">
              {([
                { mode: 'date-desc', label: '时间从新到旧', icon: Calendar },
                { mode: 'date-asc', label: '时间从旧到新', icon: Calendar },
                { mode: 'name-asc', label: '名称 A→Z', icon: ArrowUpAZ },
                { mode: 'name-desc', label: '名称 Z→A', icon: ArrowDownZA },
              ] as const).map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                    sortMode === mode
                      ? 'bg-neon-cyan/10 text-neon-cyan'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chip bg-ink-800 text-slate-400 border border-ink-600">
          {filteredAndSortedIcons.length} / {payload.icons.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4" onClick={() => setShowSortMenu(false)}>
        {filteredAndSortedIcons.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500">
            <Search className="w-10 h-10 mb-3 opacity-50" />
            <div className="text-sm">没有匹配搜索结果的图标</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {filteredAndSortedIcons.map((icon, idx) => (
              <div
                key={`${icon.name}-${icon.addedAt}-${idx}`}
                onClick={() => setPreviewIcon(icon)}
                className="group relative bg-ink-800/50 border border-ink-600 rounded-lg overflow-hidden cursor-pointer transition-all hover:border-neon-cyan/50 hover:shadow-glow-cyan"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewIcon(icon); }}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-md bg-ink-900/80 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-neon-cyan hover:text-ink-950 text-slate-300"
                  title="查看大图"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <div className="aspect-square checkerboard p-3 flex items-center justify-center">
                  <img
                    src={icon.dataUrl}
                    alt={icon.name}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
                <div className="px-2.5 py-2 bg-ink-900/50 border-t border-ink-700/30">
                  <div className="text-[11px] text-slate-300 truncate font-mono">{icon.name}</div>
                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-slate-500 font-mono">
                    <span>{icon.width}×{icon.height}</span>
                    <span>{formatDate(icon.addedAt).split(' ')[0]}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewIcon && (
        <div
          onClick={handleBackdropClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col">
            <button
              onClick={() => setPreviewIcon(null)}
              className="absolute -top-12 right-0 w-9 h-9 rounded-lg bg-ink-800 border border-ink-600 text-slate-300 hover:text-white hover:border-ink-500 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="card p-4 flex flex-col max-h-[90vh]">
              <div className="flex-1 min-h-0 flex items-center justify-center checkerboard rounded-lg overflow-hidden bg-ink-900 mb-3" style={{ minWidth: '300px', minHeight: '300px' }}>
                <img
                  src={previewIcon.dataUrl}
                  alt={previewIcon.name}
                  className="max-w-[80vw] max-h-[65vh] object-contain"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-ink-700/30">
                <div>
                  <div className="text-sm font-medium text-white font-mono">{previewIcon.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {previewIcon.width} × {previewIcon.height} · 添加于 {formatDate(previewIcon.addedAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Link as LinkIcon,
  Copy,
  Check,
  Clock,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Sparkles,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useAppStore } from '@/store/useAppStore';
import type { Project, ExpireOption, IconItem } from '@/types';
import {
  createSharePayload,
  encodeShareLink,
  formatExpireLabel,
  estimateShareSize,
  MAX_URL_CHARS,
} from '@/services/share';

interface ShareDialogProps {
  project: Project;
  onClose: () => void;
}

const EXPIRE_OPTIONS: ExpireOption[] = ['1h', '24h', '7d', '30d', 'never'];

export default function ShareDialog({ project, onClose }: ShareDialogProps) {
  const toast = useToast();
  const { getIconsInProject } = useAppStore();
  const [expireOption, setExpireOption] = useState<ExpireOption>('7d');
  const [showExpireDropdown, setShowExpireDropdown] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [icons, setIcons] = useState<IconItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const result = await getIconsInProject(project.id);
        if (!cancelled) {
          setIcons(result.items);
        }
      } catch {
        toast.showError('加载项目图标失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project.id, getIconsInProject, toast]);

  const sizeEstimate = useMemo(() => estimateShareSize(icons), [icons]);

  const handleGenerate = async () => {
    if (icons.length === 0) {
      toast.showWarning('项目中没有图标可分享');
      return;
    }
    if (usePassword && password.length < 4) {
      toast.showWarning('密码至少需要 4 个字符');
      return;
    }
    setIsGenerating(true);
    try {
      const payload = await createSharePayload(
        project,
        icons,
        expireOption,
        usePassword ? password : null
      );
      const result = await encodeShareLink(payload, usePassword ? password : null);

      if (result.charCount > MAX_URL_CHARS) {
        toast.showWarning(
          `链接过长（${result.charCount} 字符），部分浏览器可能无法正常打开，建议减少图标数量或压缩图片`
        );
      }

      setShareUrl(result.url);
      setCharCount(result.charCount);
      toast.showSuccess('分享链接已生成');
    } catch {
      toast.showError('生成分享链接失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.showSuccess('链接已复制到剪贴板');
    } catch {
      toast.showError('复制失败，请手动复制');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-ink-600/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neon-cyan/15 border border-neon-cyan/30 flex items-center justify-center">
              <LinkIcon className="w-4.5 h-4.5 text-neon-cyan" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">分享项目</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{project.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn !px-2 !py-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3 p-3 bg-ink-800/50 rounded-lg border border-ink-600/30">
            <ImageIcon className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="flex-1 text-sm">
              {isLoading ? (
                <span className="text-slate-400">正在加载图标...</span>
              ) : (
                <span className="text-slate-300">
                  共 <span className="text-neon-cyan font-semibold">{icons.length}</span> 个图标将被分享
                </span>
              )}
            </div>
            {!isLoading && sizeEstimate.exceedsLimit && (
              <div className="flex items-center gap-1 text-xs text-neon-amber" title="链接可能过长">
                <AlertTriangle className="w-3.5 h-3.5" />
                链接过长
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              有效期
            </label>
            <div className="relative">
              <button
                onClick={() => setShowExpireDropdown((v) => !v)}
                className="input w-full flex items-center justify-between text-left"
                type="button"
              >
                <span>{formatExpireLabel(expireOption)}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
              {showExpireDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-ink-800 border border-ink-600 rounded-lg shadow-xl overflow-hidden z-10">
                  {EXPIRE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setExpireOption(opt); setShowExpireDropdown(false); }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        expireOption === opt
                          ? 'bg-neon-cyan/10 text-neon-cyan'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {formatExpireLabel(opt)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              {usePassword ? (
                <Lock className="w-4 h-4 text-neon-amber" />
              ) : (
                <Unlock className="w-4 h-4 text-slate-400" />
              )}
              密码保护
            </label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setUsePassword((v) => !v)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  usePassword
                    ? 'bg-neon-amber/10 border-neon-amber/30'
                    : 'bg-ink-800 border-ink-600 hover:border-ink-500'
                }`}
              >
                <span className={`text-sm ${usePassword ? 'text-neon-amber' : 'text-slate-300'}`}>
                  {usePassword ? '已启用密码保护' : '点击启用密码保护'}
                </span>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${
                  usePassword ? 'bg-neon-amber' : 'bg-ink-600'
                }`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    usePassword ? 'left-5' : 'left-0.5'
                  }`} />
                </div>
              </button>
              {usePassword && (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="设置访问密码"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {password.length > 0 && password.length < 4 && (
                    <p className="text-xs text-rose-400 mt-1">密码至少 4 个字符</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {shareUrl && (
            <div className="p-4 bg-ink-900/60 rounded-lg border border-neon-cyan/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
                <span className="text-sm font-medium text-neon-cyan">分享链接已生成</span>
                <span className="chip bg-ink-700 text-slate-400 text-[10px] ml-auto font-mono">
                  {charCount} chars
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="input text-xs font-mono flex-1 pr-2 overflow-hidden"
                />
                <button onClick={handleCopy} className="btn btn-secondary !px-3 shrink-0">
                  {copied ? <Check className="w-4 h-4 text-neon-lime" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                查看者通过此链接可在线浏览图标，但无法进行任何编辑操作。
              </p>
            </div>
          )}

          {sizeEstimate.recommendOptimize && !shareUrl && (
            <div className="p-3 bg-neon-amber/5 border border-neon-amber/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-neon-amber shrink-0 mt-0.5" />
              <div className="text-xs text-neon-amber/90 leading-relaxed">
                项目较大，生成的链接可能较长。建议使用 PNG 压缩工具优化图标后再分享，或减少分享的图标数量。
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-ink-600/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            关闭
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || isGenerating || icons.length === 0}
            className="btn btn-primary min-w-[140px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4" />
                {shareUrl ? '重新生成' : '生成分享链接'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

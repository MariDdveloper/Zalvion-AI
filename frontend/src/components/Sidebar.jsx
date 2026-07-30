import { useState, useEffect } from "react";
import {
  Plus, Search, Trash2, Download, LogOut, PanelLeftClose, MessageSquare,
  MoreHorizontal, FolderPlus, Folder, ChevronDown, ChevronRight, Pencil, Check, X, Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LanguageMenu from "./LanguageMenu";

export default function Sidebar({
  chats, folders, activeId, onNew, onSelect, onDelete, onRename, onMove,
  onNewFolder, onRenameFolder, onDeleteFolder, onClose, lang, onLang, t, onDownload,
  onUpgrade,
}) {
  const { user, logout } = useAuth();
  const [q, setQ] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [moveOpenId, setMoveOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderEditValue, setFolderEditValue] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const filtered = chats.filter((c) => (c.title || "").toLowerCase().includes(q.toLowerCase()));
  const ungrouped = filtered.filter((c) => !c.folder_id);

  const closeMenus = () => { setOpenMenuId(null); setMoveOpenId(null); };

  const startRename = (chat) => { setEditingId(chat.chat_id); setEditValue(chat.title || ""); closeMenus(); };
  const commitRename = (id) => { if (editValue.trim()) onRename(id, editValue.trim()); setEditingId(null); };

  const commitNewFolder = () => {
    if (newFolderName.trim()) onNewFolder(newFolderName.trim());
    setNewFolderName(""); setCreatingFolder(false);
  };

  const commitFolderRename = (id) => { if (folderEditValue.trim()) onRenameFolder(id, folderEditValue.trim()); setEditingFolderId(null); };

  const ChatRow = ({ chat }) => {
    const isActive = activeId === chat.chat_id;
    if (editingId === chat.chat_id) {
      return (
        <div className="flex items-center gap-1 px-2 py-1">
          <input data-testid={`rename-input-${chat.chat_id}`} autoFocus value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(chat.chat_id); if (e.key === "Escape") setEditingId(null); }}
            onBlur={() => commitRename(chat.chat_id)}
            className="flex-1 text-sm bg-white border border-[var(--primary)] rounded-lg px-2 py-1 outline-none" />
        </div>
      );
    }
    return (
      <div
        className={`group/row relative flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors ${isActive ? "bg-white shadow-sm" : "hover:bg-black/[0.04]"}`}
        onClick={() => onSelect(chat.chat_id)} data-testid={`chat-item-${chat.chat_id}`}>
        <MessageSquare size={15} className="text-[var(--text-secondary)] flex-shrink-0" />
        <span className="flex-1 truncate text-sm">{chat.title || t.newChat}</span>
        <button data-testid={`chat-menu-${chat.chat_id}`}
          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === chat.chat_id ? null : chat.chat_id); setMoveOpenId(null); }}
          className="opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-black/10 transition-all">
          <MoreHorizontal size={15} />
        </button>

        {openMenuId === chat.chat_id && (
          <div className="absolute right-2 top-9 z-50 w-44 bg-white border border-[var(--border-subtle)] rounded-xl shadow-xl p-1.5 fade-up" onClick={(e) => e.stopPropagation()}>
            <button data-testid={`rename-chat-${chat.chat_id}`} onClick={() => startRename(chat)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm hover:bg-black/[0.04]">
              <Pencil size={14} /> {t.rename}
            </button>
            <button data-testid={`move-chat-${chat.chat_id}`} onClick={() => setMoveOpenId(moveOpenId === chat.chat_id ? null : chat.chat_id)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm hover:bg-black/[0.04]">
              <span className="flex items-center gap-2"><Folder size={14} /> {t.moveTo}</span>
              <ChevronRight size={13} />
            </button>
            {moveOpenId === chat.chat_id && (
              <div className="pl-2 mt-0.5 max-h-44 overflow-auto border-l border-[var(--border-subtle)] ml-2">
                {chat.folder_id && (
                  <button onClick={() => { onMove(chat.chat_id, null); closeMenus(); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-black/[0.04]">
                    <X size={13} /> {t.removeFromFolder}
                  </button>
                )}
                {folders.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--text-secondary)]">—</p>}
                {folders.map((f) => (
                  <button key={f.folder_id} data-testid={`move-to-${f.folder_id}`}
                    onClick={() => { onMove(chat.chat_id, f.folder_id); closeMenus(); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-black/[0.04] truncate">
                    <Folder size={13} /> <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button data-testid={`delete-chat-${chat.chat_id}`} onClick={() => { onDelete(chat.chat_id); closeMenus(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--error)]/10">
              <Trash2 size={14} /> {t.deleteChat}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] w-[280px]">
      {openMenuId && <div className="fixed inset-0 z-40" onClick={closeMenus} />}

      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="claus-orb" style={{ width: 30, height: 30 }} />
          <span className="font-serif text-xl">Zalvion AI</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-black/5"><PanelLeftClose size={18} /></button>
      </div>

      <div className="px-3 flex items-center gap-2">
        <button data-testid="new-chat-button" onClick={onNew}
          className="flex-1 flex items-center gap-2 bg-white border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 font-medium text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors shadow-sm">
          <Plus size={18} strokeWidth={2} /> {t.newChat}
        </button>
        <button data-testid="new-folder-button" onClick={() => setCreatingFolder(true)} title={t.newFolder}
          className="p-2.5 bg-white border border-[var(--border-subtle)] rounded-xl hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors shadow-sm">
          <FolderPlus size={18} />
        </button>
      </div>

      {creatingFolder && (
        <div className="px-3 mt-2 flex items-center gap-1 fade-up">
          <input data-testid="new-folder-input" autoFocus value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitNewFolder(); if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); } }}
            placeholder={t.folderName}
            className="flex-1 text-sm bg-white border border-[var(--primary)] rounded-lg px-2.5 py-1.5 outline-none" />
          <button data-testid="confirm-folder-button" onClick={commitNewFolder} className="p-1.5 rounded-lg bg-[var(--primary)] text-white"><Check size={15} /></button>
          <button onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="p-1.5 rounded-lg hover:bg-black/5"><X size={15} /></button>
        </div>
      )}

      <div className="px-3 mt-3">
        <div className="flex items-center gap-2 bg-black/[0.03] rounded-xl px-3 py-2">
          <Search size={15} className="text-[var(--text-secondary)]" />
          <input data-testid="search-chats-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
            className="bg-transparent outline-none text-sm w-full" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 mt-3 space-y-1" data-testid="chat-list">
        {/* Folders */}
        {folders.map((f) => {
          const folderChats = filtered.filter((c) => c.folder_id === f.folder_id);
          const isCollapsed = collapsed[f.folder_id];
          return (
            <div key={f.folder_id} data-testid={`folder-${f.folder_id}`}>
              <div className="group/fold flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-black/[0.03]">
                <button onClick={() => setCollapsed((p) => ({ ...p, [f.folder_id]: !p[f.folder_id] }))} className="p-0.5">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                {editingFolderId === f.folder_id ? (
                  <input autoFocus value={folderEditValue} onChange={(e) => setFolderEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitFolderRename(f.folder_id); if (e.key === "Escape") setEditingFolderId(null); }}
                    onBlur={() => commitFolderRename(f.folder_id)}
                    className="flex-1 text-sm bg-white border border-[var(--primary)] rounded px-1.5 py-0.5 outline-none" />
                ) : (
                  <>
                    <Folder size={14} className="text-[var(--primary)]" />
                    <span className="flex-1 truncate text-sm font-medium" onDoubleClick={() => { setEditingFolderId(f.folder_id); setFolderEditValue(f.name); }}>{f.name}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{folderChats.length}</span>
                    <button onClick={() => { setEditingFolderId(f.folder_id); setFolderEditValue(f.name); }} className="opacity-0 group-hover/fold:opacity-100 p-1 rounded hover:bg-black/10"><Pencil size={12} /></button>
                    <button data-testid={`delete-folder-${f.folder_id}`} onClick={() => onDeleteFolder(f.folder_id)} className="opacity-0 group-hover/fold:opacity-100 p-1 rounded hover:text-[var(--error)]"><Trash2 size={12} /></button>
                  </>
                )}
              </div>
              {!isCollapsed && (
                <div className="pl-3 space-y-0.5">
                  {folderChats.map((c) => <ChatRow key={c.chat_id} chat={c} />)}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped */}
        {ungrouped.length > 0 && folders.length > 0 && (
          <p className="px-3 pt-2 pb-1 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t.ungrouped}</p>
        )}
        {ungrouped.map((c) => <ChatRow key={c.chat_id} chat={c} />)}
      </div>

      <div className="border-t border-[var(--border-subtle)] p-3 space-y-2">
        {user && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-accent)] p-3" data-testid="sidebar-usage">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
              <span>{Math.max(0, (user.usage_limit || 10) - (user.usage_used || 0))} {t.messagesLeft}</span>
              <span>{user.usage_used || 0}/{user.usage_limit || 10}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
              <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${Math.min(100, ((user.usage_used || 0) / (user.usage_limit || 10)) * 100)}%` }} />
            </div>
          </div>
        )}
        <button data-testid="open-download-button" onClick={onDownload}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-black/[0.04] transition-colors">
          <Download size={16} /> {t.download}
        </button>
        <LanguageMenu lang={lang} onChange={onLang} t={t} />
        <div className="flex items-center gap-2.5 px-2 pt-1">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-sm font-medium uppercase">
              {(user?.name || user?.email || "U")[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{user?.email}</p>
          </div>
          <button data-testid="logout-button" onClick={logout} className="p-2 rounded-lg hover:bg-black/5" title={t.logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

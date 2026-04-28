import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Code2, 
  Eye, 
  Send, 
  Terminal, 
  ChevronRight, 
  RefreshCw, 
  Layout, 
  FileCode, 
  Copy,
  Check,
  PanelRightOpen,
  PanelLeftOpen,
  Share2,
  ChevronLeft,
  X,
  Download,
  Settings2,
  File,
  FolderOpen,
  Zap,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import JSZip from "jszip";

// --- Types ---

interface Message {
  role: "user" | "ai";
  text: string;
}

interface WebFile {
  name: string;
  content: string;
  language: "html" | "css" | "javascript";
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [files, setFiles] = useState<WebFile[]>([]);
  const [activeFileName, setActiveFileName] = useState<string>("index.html");
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [copied, setCopied] = useState(false);

  const [isNetlifyModalOpen, setIsNetlifyModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [generationLanguage, setGenerationLanguage] = useState("British English");
  const [viewportSize, setViewportSize] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [selectedProvider, setSelectedProvider] = useState<"google" | "openai">("google");
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [openaiKey, setOpenaiKey] = useState("");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- File Save/Restore ---
  const exportProjectData = () => {
    if (files.length === 0) return;
    const data = JSON.stringify({ files, messages, generationLanguage });
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wizzard_save_file.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importProjectData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.files) setFiles(data.files);
        if (data.messages) setMessages(data.messages);
        if (data.generationLanguage) setGenerationLanguage(data.generationLanguage);
        setActiveFileName("index.html");
        setActiveTab("preview");
      } catch (err) {
        alert("Corrupted crystal found. Could not restore project.");
      }
    };
    reader.readAsText(file);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Magic Router Listener ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'WIZZARD_NAVIGATE') {
        const targetFile = event.data.fileName;
        if (files.find(f => f.name === targetFile)) {
          setActiveFileName(targetFile);
          setActiveTab("preview");
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files]);

  const activeFile = files.find(f => f.name === activeFileName) || files[0];

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMsg = input;
    setInput("");
    const newMessages = [...messages, { role: "user", text: userMsg } as Message];
    setMessages(newMessages);
    setIsGenerating(true);

    const systemInstruction = `Task: Create a fully-fledged, professional, MULTIPAGE website using ONLY plain HTML, CSS (Tailwind CSS via CDN is highly recommended), and Vanilla JavaScript. 
    Do NOT use React, Vue, or any other framework. 

    Language: All content inside the generated website MUST be in ${generationLanguage}.

    CRITICAL REQUIREMENTS:
    1. The website MUST be fully responsive and dynamically adjust to any screen size.
    2. The website MUST be MULTIPAGE. You must provide a set of files (HTML, CSS, JS).
    3. Return the response as a JSON object where keys are filenames and values are the file contents.
    4. Common files: index.html (home), about.html, contact.html, style.css, script.js.
    5. Use Material 3 Expressive design (soft shadows, large border-radius, vibrant accents, smooth transitions).
    6. Use Lucide Icons (via CDN) and Google Fonts (Plus Jakarta Sans).

    Output Format:
    Provide ONLY a JSON object. No markdown code blocks, just the JSON string.
    Example:
    {
      "index.html": "<!DOCTYPE html>...",
      "about.html": "<!DOCTYPE html>...",
      "style.css": "body { ... }",
      "script.js": "console.log(...)"
    }`;

    try {
      let responseText = "";
      
      if (selectedProvider === "google") {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [
            ...messages.map(m => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.text }]
            })),
            { role: "user", parts: [{ text: userMsg }] }
          ],
          config: {
            systemInstruction,
            responseMimeType: "application/json"
          }
        });
        responseText = response.text || "{}";
      } else {
        // OpenAI logic
        if (!openaiKey) throw new Error("Missing OpenAI Key");
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: systemInstruction },
              ...messages.map(m => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.text
              })),
              { role: "user", content: userMsg }
            ],
            response_format: { type: "json_object" }
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        responseText = data.choices[0].message.content;
      }
      try {
        const generatedFiles = JSON.parse(responseText);
        const webFiles: WebFile[] = Object.entries(generatedFiles).map(([name, content]) => {
          let lang: "html" | "css" | "javascript" = "html";
          if (name.endsWith(".css")) lang = "css";
          if (name.endsWith(".js")) lang = "javascript";
          return { name, content: content as string, language: lang };
        });

        if (webFiles.length > 0) {
          setFiles(webFiles);
          setActiveFileName("index.html");
          setMessages((prev) => [...prev, { role: "ai", text: "Magic! I've engineered your multipage site as a collection of professional files. Check the source and preview!" }]);
          setActiveTab("preview");
        } else {
          throw new Error("No files generated");
        }
      } catch (parseError) {
        console.error("Parse failed:", parseError);
        setMessages((prev) => [...prev, { role: "ai", text: "I had trouble structuring the project files. Try a simpler request!" }]);
      }
    } catch (error) {
      console.error("Gemini failed:", error);
      setMessages((prev) => [...prev, { role: "ai", text: "The magic flickered. Please try again or check your prompt." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const getCombinedPreview = () => {
    if (files.length === 0) return "";
    const currentFile = files.find(f => f.name === activeFileName) || files[0];
    if (!currentFile.name.endsWith('.html')) {
        // Find the first HTML file or index.html to show as preview even if code tab is on CSS/JS
        const index = files.find(f => f.name === "index.html") || files.find(f => f.name.endsWith('.html')) || files[0];
        return index.content;
    }

    let content = currentFile.content;

    // Inject CSS and JS
    files.forEach(f => {
      if (f.name.endsWith(".css")) {
        const regex = new RegExp(`<link[^>]+href=["']\\.?/?${f.name}["'][^>]*>`, 'gi');
        content = content.replace(regex, `<style>${f.content}</style>`);
      }
      if (f.name.endsWith(".js")) {
        const regex = new RegExp(`<script[^>]+src=["']\\.?/?${f.name}["'][^>]*>\\s*</script>`, 'gi');
        content = content.replace(regex, `<script>${f.content}</script>`);
      }
    });

    // --- Inject Magic Router ---
    // This script intercepts clicks on <a> tags that point to other generated files
    const routerScript = `
      <script>
        document.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (link && link.getAttribute('href')) {
            const href = link.getAttribute('href');
            // Check if it looks like one of our filenames
            const isLocal = !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:');
            if (isLocal) {
              e.preventDefault();
              // Clean up path (remove ./ or / from start)
              const cleanPath = href.replace(/^\\.\\//, '').replace(/^\\//, '');
              window.parent.postMessage({ type: 'WIZZARD_NAVIGATE', fileName: cleanPath }, '*');
            }
          }
        });
        
        // Ensure forms also don't break the preview
        document.addEventListener('submit', (e) => {
          e.preventDefault();
          console.log('Form submission intercepted in preview.');
        });
      </script>
    `;

    if (content.includes("</body>")) {
      content = content.replace("</body>", `${routerScript}</body>`);
    } else {
      content += routerScript;
    }

    return content;
  };

  const downloadProject = async () => {
    if (files.length === 0) return;
    
    const zip = new JSZip();
    files.forEach(file => {
      zip.file(file.name, file.content);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'website_project.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsNetlifyModalOpen(true);
  };

  const copyToClipboard = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen bg-m3-surface overflow-hidden font-sans">
      {/* Hidden Global File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={importProjectData} 
        className="hidden" 
        accept=".json"
      />
      {/* Sidebar - Desktop fixed, Mobile Slide-over */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 lg:relative lg:inset-auto flex flex-col bg-m3-surface-container-low border-r border-m3-outline/10 w-[400px] shadow-2xl lg:shadow-none"
          >
            <header className="p-4 px-6 border-b border-m3-outline/5 flex items-center justify-between bg-white/50 backdrop-blur-xl sticky top-0 z-20">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-m3-primary rounded-m3-medium flex items-center justify-center text-white shadow-lg shadow-m3-primary/20">
                    <Sparkles className="w-4 h-4" />
                 </div>
                 <h1 className="font-display text-xl font-black text-m3-primary tracking-tighter">
                   Wizzard
                 </h1>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`p-2 rounded-full transition-all ${isSettingsOpen ? 'bg-m3-primary text-white shadow-lg' : 'hover:bg-m3-surface-container-high text-m3-outline'}`}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-m3-surface-container-high rounded-full transition-colors text-m3-outline"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <AnimatePresence>
                {isSettingsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6 bg-white rounded-m3-extra-large p-5 border border-m3-primary/10 shadow-lg space-y-5"
                  >
                    <header className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-m3-primary">Settings</h4>
                    </header>

                    <div className="space-y-4">
                      {/* Provider Select */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-m3-on-surface/40 uppercase block">AI Provider</label>
                        <div className="flex bg-m3-surface-container rounded-m3-large p-1 border border-m3-outline/5">
                          {(["google", "openai"] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => {
                                setSelectedProvider(p);
                                setSelectedModel(p === "google" ? "gemini-2.0-flash" : "gpt-4o");
                              }}
                              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-m3-medium transition-all ${
                                selectedProvider === p ? 'bg-white text-m3-primary shadow-sm' : 'text-m3-on-surface/30 hover:text-m3-on-surface/60'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Model Select */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-m3-on-surface/40 uppercase block">Model</label>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-m3-surface-container-low border border-m3-outline/10 rounded-m3-large p-3 text-sm font-bold focus:border-m3-primary outline-none transition-all cursor-pointer"
                        >
                          {selectedProvider === "google" ? (
                            <>
                              <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            </>
                          ) : (
                            <>
                              <option value="gpt-4o">GPT-4o</option>
                              <option value="gpt-4o-mini">GPT-4o Mini</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            </>
                          )}
                        </select>
                      </div>

                      {selectedProvider === "openai" && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-m3-on-surface/40 uppercase block">OpenAI API Key</label>
                          <input 
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-m3-surface-container-low border border-m3-outline/10 rounded-m3-large p-3 text-sm font-bold focus:border-m3-primary outline-none transition-all"
                          />
                          <p className="text-[8px] text-red-400 font-bold leading-tight">
                            * OpenAI requires a personal key. Key is not stored on server.
                          </p>
                        </div>
                      )}

                      <div className="h-px bg-m3-outline/5" />

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-m3-on-surface/40 uppercase block">Site Language</label>
                        <select 
                          value={generationLanguage}
                          onChange={(e) => setGenerationLanguage(e.target.value)}
                          className="w-full bg-m3-surface-container-low border border-m3-outline/10 rounded-m3-large p-3 text-sm font-bold focus:border-m3-primary outline-none transition-all cursor-pointer"
                        >
                          {[
                            "British English", 
                            "US English", 
                            "Spanish", 
                            "French", 
                            "German", 
                            "Italian", 
                            "Portuguese", 
                            "Dutch", 
                            "Russian", 
                            "Chinese (Simplified)", 
                            "Chinese (Traditional)", 
                            "Japanese", 
                            "Korean", 
                            "Arabic", 
                            "Hindi", 
                            "Bengali", 
                            "Turkish", 
                            "Polish", 
                            "Swedish", 
                            "Norwegian", 
                            "Danish", 
                            "Finnish", 
                            "Greek", 
                            "Hebrew", 
                            "Thai", 
                            "Vietnamese", 
                            "Indonesian"
                          ].map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>
                      
                        <button 
                          onClick={exportProjectData}
                          disabled={files.length === 0}
                          className="w-full flex items-center justify-center gap-3 p-4 bg-m3-surface-container rounded-m3-large border border-m3-outline/10 hover:border-m3-primary transition-all disabled:opacity-30 group"
                        >
                          <Download className="w-4 h-4 text-m3-primary group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Export Archive</span>
                        </button>

                      <p className="text-[9px] text-m3-on-surface/30 font-bold italic text-center leading-tight">
                        * Geni will attempt to generate all site content in the chosen language.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 px-4 py-10">
                  <div className="space-y-3">
                    <h3 className="font-display text-3xl font-black tracking-tighter">Spark Magic.</h3>
                    <p className="text-xs text-m3-on-surface/40 font-bold leading-relaxed max-w-[220px] mx-auto uppercase tracking-wide">
                      Describe a responsive masterpiece, and watch it come alive.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 w-full pt-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-black p-5 bg-m3-primary-container text-m3-primary border border-m3-primary/20 rounded-m3-extra-large hover:shadow-xl transition-all text-center flex items-center justify-center gap-3 active:scale-95 shadow-sm group"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Restore Project Archive
                    </button>
                    <div className="flex items-center gap-4 py-2">
                      <div className="h-px flex-1 bg-m3-outline/10"></div>
                      <span className="text-[9px] font-black text-m3-on-surface/20 uppercase tracking-widest">or start fresh</span>
                      <div className="h-px flex-1 bg-m3-outline/10"></div>
                    </div>
                    {["Multipage Agency Site", "Personal Portfolio with Blog", "Luxury Resort Landing", "Tech Startup Dashboard"].map((suggestion) => (
                      <button 
                        key={suggestion}
                        onClick={() => { setInput(`Create a ${suggestion} that is perfectly responsive and has multiple internal pages (Home, Features, About, Contact).`); }}
                        className="text-[11px] font-black p-5 bg-white border border-m3-outline/10 rounded-m3-extra-large hover:border-m3-primary hover:text-m3-primary hover:shadow-xl transition-all text-left flex items-center justify-between group active:scale-95 shadow-sm"
                      >
                        {suggestion}
                        <div className="w-8 h-8 rounded-full bg-m3-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[92%] p-5 rounded-m3-extra-large text-sm font-semibold shadow-md leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-m3-primary text-white shadow-m3-primary/20' 
                        : 'bg-white text-m3-on-surface border border-m3-outline/5'
                      }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {isGenerating && (
                <div className="flex items-center gap-3 text-m3-primary font-black text-[10px] tracking-[0.2em] p-5 bg-white rounded-m3-extra-large shadow-2xl border border-m3-primary/10 animate-pulse uppercase">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Weaving web spells...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 px-6 border-t border-m3-outline/5 bg-white/60 backdrop-blur-2xl">
              <form onSubmit={handleGenerate} className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="Describe your site spell..."
                  className="w-full bg-white border border-m3-outline/10 rounded-[24px] py-4 pl-6 pr-14 text-sm font-semibold focus:border-m3-primary/30 focus:ring-4 ring-m3-primary/5 outline-none resize-none shadow-xl transition-all h-[56px] min-h-[56px] max-h-[160px] leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className={`absolute right-2.5 bottom-2.5 p-2 rounded-full transition-all ${
                    input.trim() && !isGenerating
                    ? 'bg-m3-primary text-white shadow-lg'
                    : 'bg-m3-surface-container text-m3-on-surface/20'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button 
            initial={{ x: -100 }}
            animate={{ x: 0 }}
            exit={{ x: -100 }}
            onClick={() => setSidebarOpen(true)}
            className="fixed left-8 top-1/2 -translate-y-1/2 p-5 bg-m3-primary text-white rounded-full shadow-2xl z-40 hover:scale-110 active:scale-95 transition-all shadow-m3-primary/40"
          >
            <PanelRightOpen className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-m3-surface relative">
        <div className="flex-1 overflow-hidden p-4 md:p-10 lg:p-14 mb-24 flex flex-col items-center">
          {/* Viewport Controls */}
          {activeTab === "preview" && files.length > 0 && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex bg-white/50 backdrop-blur-3xl p-1 rounded-m3-full border border-m3-outline/10 mb-6 shadow-sm overflow-hidden"
            >
                {[
                  { id: "mobile", icon: <PanelLeftOpen className="w-3.5 h-3.5 rotate-90" />, width: "375px", label: "Mobile" },
                  { id: "tablet", icon: <Layout className="w-3.5 h-3.5" />, width: "768px", label: "Tablet" },
                  { id: "desktop", icon: <Eye className="w-3.5 h-3.5" />, width: "100%", label: "Desktop" }
                ].map(size => (
                  <button
                    key={size.id}
                    onClick={() => setViewportSize(size.id as any)}
                    className={`px-5 py-2.5 rounded-m3-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${
                      viewportSize === size.id ? 'bg-m3-primary text-white shadow-lg' : 'text-m3-on-surface/40 hover:text-m3-primary/60'
                    }`}
                  >
                    {size.icon}
                    {size.label}
                  </button>
                ))}
            </motion.div>
          )}

          <div 
            className={`flex-1 w-full bg-white rounded-[56px] shadow-[0_64px_128px_-24px_rgba(0,0,0,0.18)] overflow-hidden border-8 border-m3-surface-container-high relative ring-1 ring-black/5 transition-all duration-500 ease-in-out`}
            style={{ 
              maxWidth: viewportSize === 'mobile' ? '375px' : viewportSize === 'tablet' ? '768px' : '100%',
              margin: '0 auto' 
            }}
          >
            {activeTab === "preview" ? (
              files.length > 0 ? (
                <iframe
                  srcDoc={getCombinedPreview()}
                  className="w-full h-full border-none transition-opacity duration-500"
                  title="Output Preview"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 md:p-12 bg-m3-surface-container-lowest text-m3-primary/20">
                  <Terminal className="w-24 h-24 mb-6 opacity-20" />
                  <h2 className="font-display text-4xl md:text-6xl font-black mb-6 tracking-tighter leading-none uppercase">Preview</h2>
                </div>
              )
            ) : (
              <div className="h-full flex bg-[#0d1117] flex-col lg:flex-row">
                {/* File Explorer Sidebar */}
                <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col pt-6 lg:pt-10">
                  <div className="px-6 mb-6 flex items-center gap-2 text-white/40 uppercase text-[10px] font-black tracking-widest">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Explorer
                  </div>
                  <div className="flex-1 overflow-auto px-2 pb-4 flex lg:flex-col gap-1">
                    {files.map(file => (
                      <button
                        key={file.name}
                        onClick={() => setActiveFileName(file.name)}
                        className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-m3-large text-xs font-bold transition-all ${
                          activeFileName === file.name 
                          ? 'bg-m3-primary text-white shadow-lg' 
                          : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <File className="w-4 h-4 opacity-50" />
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                    {files.length === 0 && (
                      <div className="px-4 py-8 text-center text-white/20 text-[10px] font-bold uppercase italic w-full">
                        Empty Project
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative overflow-hidden group">
                  <pre className="h-full overflow-auto p-10 md:p-14 text-blue-50 font-mono text-[10px] md:text-xs leading-[2] custom-scrollbar selection:bg-m3-primary/40">
                    <code className="text-blue-200">
                      {activeFile?.content || "// Cast a spell to see the source..."}
                    </code>
                  </pre>
                  <div className="absolute top-6 right-6 flex items-center gap-2 pointer-events-none">
                    <div className="bg-m3-primary/20 backdrop-blur-3xl rounded-full px-6 py-2 text-[10px] font-black text-m3-primary uppercase tracking-[0.3em] border border-m3-primary/10 shadow-2xl">
                      {activeFile?.name.split('.').pop()?.toUpperCase() || "FILES"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <header className="fixed bottom-0 left-0 lg:left-[400px] lg:ml-0 right-0 h-24 bg-white/70 backdrop-blur-3xl border-t border-m3-outline/10 px-4 md:px-8 flex items-center justify-center z-10 transition-all">
          <div className="flex bg-m3-surface-container-low p-1.5 rounded-m3-full shadow-inner border border-m3-outline/5 scale-90 sm:scale-100">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-m3-full text-xs sm:text-sm font-black transition-all uppercase tracking-tight ${
                activeTab === "preview" 
                ? 'bg-white text-m3-primary shadow-lg ring-1 ring-black/5' 
                : 'text-m3-on-surface/50 hover:text-m3-on-surface'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-m3-full text-xs sm:text-sm font-black transition-all uppercase tracking-tight ${
                activeTab === "code" 
                ? 'bg-white text-m3-primary shadow-lg ring-1 ring-black/5' 
                : 'text-m3-on-surface/50 hover:text-m3-on-surface'
              }`}
            >
              <FileCode className="w-4 h-4" />
              Source
            </button>
          </div>

          <div className="absolute right-8 flex items-center gap-2 sm:gap-3">
             <button 
              onClick={copyToClipboard}
              disabled={files.length === 0}
              className="flex items-center gap-2 text-[10px] font-black text-m3-primary py-3 px-5 hover:bg-m3-primary/5 rounded-m3-full transition-all uppercase tracking-widest disabled:opacity-30 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copy' : 'Copy'}
            </button>
            <button 
              onClick={exportProjectData}
              disabled={files.length === 0}
              className="hidden sm:flex items-center gap-2 text-[10px] font-black text-m3-on-surface/40 py-3 px-5 hover:bg-m3-on-surface/5 rounded-m3-full transition-all uppercase tracking-widest disabled:opacity-30 active:scale-95"
              title="Save project state to continue later"
            >
              <Download className="w-3.5 h-3.5" />
              Save Project
            </button>
            <button 
              onClick={downloadProject}
              disabled={files.length === 0}
              className="m3-button-primary py-3 px-8 shadow-2xl shadow-m3-primary/20 text-[10px] tracking-widest uppercase truncate disabled:opacity-50 active:scale-95 bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-3.5 h-3.5 mr-2" />
              <span className="hidden sm:inline">Export ZIP</span>
            </button>
          </div>
        </header>

        {/* Netlify Steps Modal */}
        <AnimatePresence>
          {isNetlifyModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-m3-on-surface">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-m3-on-surface/60 backdrop-blur-md"
                onClick={() => setIsNetlifyModalOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 40, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-[48px] p-12 shadow-[0_64px_128px_rgba(0,0,0,0.5)] text-center border border-m3-outline/5"
              >
                <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl rotate-6 transition-transform hover:rotate-0">
                  <Share2 className="w-12 h-12" />
                </div>
                <h3 className="font-display text-4xl font-black mb-6 tracking-tighter">Launch to the Web!</h3>
                
                <div className="space-y-6 mb-10 text-left">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-black flex-shrink-0">1</div>
                    <p className="text-m3-on-surface/60 font-bold text-sm">I've downloaded your <span className="text-m3-primary">website_project.zip</span> containing all files.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-black flex-shrink-0">2</div>
                    <p className="text-m3-on-surface/60 font-bold text-sm">Open <span className="text-blue-500 font-black">Netlify Drop</span> in a new tab.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-black flex-shrink-0">3</div>
                    <p className="text-m3-on-surface/60 font-bold text-sm">Simply <span className="text-m3-primary font-black">drag & drop the ZIP file</span> you just downloaded onto the Netlify page.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <a 
                    href="https://app.netlify.com/drop" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="m3-button-primary justify-center bg-blue-600 hover:bg-blue-700 shadow-blue-600/30 py-5"
                  >
                    Open Netlify Drop
                    <ExternalLink className="w-5 h-5 ml-2" />
                  </a>
                  <button 
                    onClick={() => setIsNetlifyModalOpen(false)}
                    className="p-4 text-xs font-black text-m3-on-surface/40 uppercase hover:text-m3-on-surface transition-colors tracking-widest"
                  >
                    Close & Keep Weaving
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        />
      )}
    </div>
  );
}

import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({plugins:[react()],resolve:{alias:{"@":path.resolve(root,"./src")}},build:{outDir:path.resolve(root,"dist"),emptyOutDir:true},server:{port:5173}});

import { Plugin } from "obsidian";

// src/main.ts (additions)
import { parseTree } from "./tree/parse";
import { renderTree } from "src/tree/render";
import { GlossParser } from "src/parser/main";
import { GlossRenderer } from "src/render/main";
import { PluginSettingsTab } from "src/settings/main";
import { PluginSettingsWrapper } from "src/settings/wrapper";


export default class LingGlossPlugin extends Plugin {
    settings = new PluginSettingsWrapper(this);
    parser = new GlossParser(this.settings);
    renderer = new GlossRenderer(this.settings);

    async onload() {
        await this.settings.load();

        this.addSettingTab(new PluginSettingsTab(this, this.settings));

        this.registerMarkdownCodeBlockProcessor("gloss", (src, el, _) => this.processGlossMarkdown(src, el, false));
        this.registerMarkdownCodeBlockProcessor("ngloss", (src, el, _) => this.processGlossMarkdown(src, el, true));
        // Inline syntax: {{tree: [VP [V' [V see] [DP her]]]]}}
        this.registerMarkdownPostProcessor((el, ctx) => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const toReplace: { node: Text; match: RegExpMatchArray }[] = [];
            const pat = /\{\{tree:\s*([\s\S]+?)\s*\}\}/g; // minimal match
            while (walker.nextNode()) {
                const textNode = walker.currentNode as Text;
                const text = textNode.nodeValue || "";
                let m: RegExpMatchArray | null;
                pat.lastIndex = 0;
                while ((m = pat.exec(text))) {
                toReplace.push({ node: textNode, match: m });
                }
            }
            toReplace.forEach(({ node, match }) => {
                const full = match[0];
                const src  = match[1];
                const parent = node.parentNode!;
                const before = (node.nodeValue || "").split(full)[0];
                const after  = (node.nodeValue || "").slice((node.nodeValue || "").indexOf(full) + full.length);

                // Replace the text node by three nodes: before, SVG, after
                if (before) parent.insertBefore(document.createTextNode(before), node);
                try {
                const ast = parseTree(src);
                const svg = renderTree(ast);
                svg.classList.add("ling-tree-inline");
                parent.insertBefore(svg, node);
                } catch (e) {
                const span = document.createElement("span");
                span.className = "ling-tree-error";
                span.textContent = "[tree parse error]";
                parent.insertBefore(span, node);
                }
                if (after) parent.insertBefore(document.createTextNode(after), node);
                parent.removeChild(node);
            });
            });

            // Block syntax: ```tree ... ```
            this.registerMarkdownCodeBlockProcessor("tree", async (src, el) => {
            try {
                const ast = parseTree(src.trim());
                const svg = renderTree(ast);
                el.appendChild(svg);
            } catch (e) {
                const pre = el.createEl("pre");
                pre.setText(`Tree parse error: ${(e as Error).message}`);
            }
            });

    }

    private processGlossMarkdown(source: string, el: HTMLElement, nlevel: boolean) {
        const glossData = this.parser.parse(source, nlevel);

        if (glossData.success) {
            this.renderer.renderGloss(el, glossData.data);
        } else {
            this.renderer.renderErrors(el, glossData.errors);
        }
    }
}
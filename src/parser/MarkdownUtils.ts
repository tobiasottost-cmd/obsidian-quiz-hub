import { App, Component, MarkdownRenderer } from 'obsidian';

export class MarkdownUtils {
    /**
     * Renders markdown asynchronously into the provided HTML container using Obsidian's native MarkdownRenderer.
     * Handles LaTeX formulas ($...$ and $$...$$), internal vault images (![[image.png]]), wikilinks and callouts.
     */
    public static async render(
        app: App,
        markdown: string,
        containerEl: HTMLElement,
        sourcePath: string,
        component: Component
    ): Promise<void> {
        containerEl.empty();
        try {
            await MarkdownRenderer.render(app, markdown, containerEl, sourcePath, component);
        } catch (error) {
            console.error('Error rendering markdown with MarkdownRenderer:', error);
            // Graceful fallback to textContent in case of rendering glitch
            containerEl.setText(markdown);
        }
    }
}

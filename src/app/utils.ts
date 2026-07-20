export function toSlug(text: string) : string {
    if (!text) return '';
    return text
    .toLowerCase()
    .trim()
    .replace(/[\s\_]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-');
}
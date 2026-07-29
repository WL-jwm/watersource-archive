/**
 * G3: 国际化框架 (i18n) — 薄包装层
 *
 * 词典已拆分为模块化目录结构：
 *   src/lib/i18n/
 *     index.tsx   ← 实际实现（Provider + Hook + LocaleSwitcher + translations）
 *     zh/          ← 中文词典（common/layout/nav/forms/professional/pages）
 *     en/          ← 英文词典（同结构镜像）
 *
 * 本文件仅做重新导出，保持 @/lib/i18n 导入路径不变
 *
 * 后续新增键值时，请直接编辑 src/lib/i18n/zh/ 和 src/lib/i18n/en/ 下的模块文件
 */

export { I18nProvider, useI18n, LocaleSwitcher, translations } from './i18n/index';
export type { Locale, TranslationDict } from './i18n/index';

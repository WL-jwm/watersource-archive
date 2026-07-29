/** 中文词典聚合 — 合并所有模块 */

import { common } from './common';
import { layout } from './layout';
import { nav } from './nav';
import { forms } from './forms';
import { professional } from './professional';
import { pages } from './pages';

export const zh = {
  ...common,
  ...layout,
  ...nav,
  ...forms,
  ...professional,
  ...pages,
};

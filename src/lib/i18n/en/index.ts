/** English dictionary aggregate — merge all modules */

import { common } from './common';
import { layout } from './layout';
import { nav } from './nav';
import { forms } from './forms';
import { professional } from './professional';
import { pages } from './pages';

export const en = {
  ...common,
  ...layout,
  ...nav,
  ...forms,
  ...professional,
  ...pages,
};

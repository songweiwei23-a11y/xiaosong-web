// 联网搜索实验入口：把自由对话的联网链路各步骤导出来，逐步观察丢在哪一步。
export { buildWebQuery, isNewsQuestion } from '../../lib/web-query';
export { wantsWebSearch } from '../../lib/web-search-quota';
export { aliSearch } from '../../lib/ali-search';
export { getSearchConfig } from '../../lib/search-config';
export { freeChatWebQuery, pickFreeChatSources } from '../../lib/web-source-quality';
export { searchFreeChatWeb } from '../../lib/free-chat-web';
export { fetchPage } from '../../lib/page-fetch';
export { extractMainText } from '../../lib/html-text';

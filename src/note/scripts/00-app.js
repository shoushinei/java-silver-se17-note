/* 全モジュール共通の名前空間。
   ビルド時に build.mjs が NoteApp.chapters（章IDの配列）を差し込むので、
   章を増やしても JavaScript 側を書き換える必要はない。 */
var NoteApp = window.NoteApp || (window.NoteApp = {});
NoteApp.chapters = NoteApp.chapters || [];

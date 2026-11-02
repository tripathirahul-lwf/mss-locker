const owners = new Set<symbol>();
let originalOverflow = '';
/** Release tokens allow nested dialogs to unmount in any order. */
export function lockBodyScroll(): () => void {
 if (!owners.size) originalOverflow = document.body.style.overflow;
 const owner = Symbol('modal'); owners.add(owner); document.body.style.overflow = 'hidden';
 return () => { if (!owners.delete(owner)) return; if (!owners.size) document.body.style.overflow = originalOverflow; };
}

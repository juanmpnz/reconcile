import type { ComponentProps } from 'react';

/** Semantic table building blocks for evidence with contextual content; use DataTable for collections. */
export function Table(props: ComponentProps<'table'>) {
  return <table {...props} />;
}
export function TableCaption(props: ComponentProps<'caption'>) {
  return <caption {...props} />;
}
export function TableHead(props: ComponentProps<'thead'>) {
  return <thead {...props} />;
}
export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}
export function TableRow(props: ComponentProps<'tr'>) {
  return <tr {...props} />;
}
export function TableHeader(props: ComponentProps<'th'>) {
  return <th {...props} />;
}
export function TableCell(props: ComponentProps<'td'>) {
  return <td {...props} />;
}

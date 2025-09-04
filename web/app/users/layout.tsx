export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className='min-h-screen bg-black text-white'>{children}</main>;
}

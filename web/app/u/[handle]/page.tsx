import ProfilePage from '@/components/ProfilePage';

export default function Page({ params }: { params: { handle: string } }) {
  return <ProfilePage handle={params.handle} />;
}

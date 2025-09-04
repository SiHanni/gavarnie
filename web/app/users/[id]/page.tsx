import dynamic from 'next/dynamic';

const ProfilePage = dynamic(() => import('@/components/ProfilePage'), {
  ssr: false,
});

export default function Page({ params }: { params: { id: string } }) {
  return <ProfilePage userId={params.id} />;
}

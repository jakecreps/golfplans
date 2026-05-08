'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function PlanRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/plans/${id}/join`);
  }, [id, router]);

  return null;
}

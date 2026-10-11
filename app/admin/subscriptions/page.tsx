import { redirect } from 'next/navigation';

// Supporters live on the Money page now, beside deal credit and paid checks.
// This address stays so old links still land somewhere.
export default function AdminSubscriptionsPage() {
  redirect('/admin/money');
}

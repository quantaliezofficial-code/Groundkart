import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <Helmet>
        <title>Page Not Found — GroundBooking</title>
      </Helmet>
      <div className="text-center">
        <p className="text-6xl font-bold text-green-600 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Page not found</h1>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";

/**
 * Not Found page for 404 errors
 *
 * @returns The Not Found page component
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-3xl font-bold">404 - Page Not Found</h1>
      <p className="mb-6 mt-4">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Return Home
      </Link>
    </div>
  );
}

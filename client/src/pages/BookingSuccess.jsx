export default function BookingSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-500">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-600">You will receive a confirmation email shortly.</p>
        <a href="/" className="mt-4 inline-block text-purple-600 hover:text-purple-700">
          Return Home
        </a>
      </div>
    </div>
  );
}

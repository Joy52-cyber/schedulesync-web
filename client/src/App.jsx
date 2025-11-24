<Route
  element={
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  }
>
  <Route path="/dashboard" element={<Dashboard />} />

  <Route path="/bookings" element={<Bookings />} />
  <Route path="/my-booking-link" element={<MyBookingLink />} />
  <Route path="/events" element={<EventTypes />} />

  {/* ✅ Correct Availability Route — only once! */}
  <Route
    path="/teams/:teamId/members/:memberId/availability"
    element={<MemberAvailability />}
  />

  <Route path="/teams" element={<Teams />} />
  <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
  <Route path="/teams/:teamId/members" element={<TeamMembers />} />

  <Route path="/settings" element={<UserSettings />} />
  <Route path="/settings/calendar" element={<CalendarSettings />} />
</Route>

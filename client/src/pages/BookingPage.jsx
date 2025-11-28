<div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                      <textarea 
                        value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                        rows="3"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                        placeholder="Anything specific you want to discuss?"
                      />
                    </div>

                    {/* ✅ NEW: Add More People Section */}
                    <div className="pt-4 border-t border-slate-200">
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Invite Others to This Meeting
                      </label>
                      
                      {/* List of added attendees */}
                      {additionalAttendees.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {additionalAttendees.map((email, index) => (
                            <div key={index} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg group">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-700">{email}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttendee(email)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Remove attendee"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add attendee input */}
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newAttendeeEmail}
                          onChange={(e) => setNewAttendeeEmail(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAttendee();
                            }
                          }}
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                          placeholder="colleague@example.com"
                        />
                        <button
                          type="button"
                          onClick={handleAddAttendee}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Additional attendees will receive calendar invites and meeting details
                      </p>
                    </div>

                    <button 
                      type="submit" disabled={submitting} 
                      className="w-full mt-4 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="animate-spin" /> : (isReschedule ? 'Confirm Reschedule' : 'Confirm Booking')}
                    </button>
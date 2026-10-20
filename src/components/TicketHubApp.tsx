import React, { useState } from 'react';
import { 
  INITIAL_EVENTS, 
  Event, 
  Seat, 
  ActiveHold, 
  Order, 
  OrderItem 
} from '../data/mockEvents';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Search, 
  Sparkles, 
  Check, 
  X, 
  CreditCard, 
  ShieldCheck, 
  Zap, 
  Ticket as TicketIcon,
  ChevronRight,
  QrCode
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { v4 as uuidv4 } from 'uuid';

interface TicketHubAppProps {
  activeHold: ActiveHold | null;
  setActiveHold: React.Dispatch<React.SetStateAction<ActiveHold | null>>;
  holdSeconds: number;
  setHoldSeconds: React.Dispatch<React.SetStateAction<number>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  isOrdersOpen: boolean;
  setIsOrdersOpen: (open: boolean) => void;
}

export const TicketHubApp: React.FC<TicketHubAppProps> = ({
  activeHold,
  setActiveHold,
  holdSeconds,
  setHoldSeconds,
  orders,
  setOrders,
  isCheckoutOpen,
  setIsCheckoutOpen,
  isOrdersOpen,
  setIsOrdersOpen,
}) => {
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-101');
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('Alex Morgan');
  const [customerEmail, setCustomerEmail] = useState('alex.morgan@example.com');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter events
  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.artistOrOrganizer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || e.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  // Calculate selected seats details
  const selectedSeatsList = selectedEvent.seats.filter(s => selectedSeatIds.includes(s.id));
  const subtotal = selectedSeatsList.reduce((acc, s) => acc + s.price, 0);
  const serviceFee = Math.round(subtotal * 0.1);
  const facilityFee = selectedSeatsList.length > 0 ? 4.5 : 0;
  const grandTotal = subtotal + serviceFee + facilityFee;

  // Toggle seat selection
  const handleSeatClick = (seat: Seat) => {
    if (seat.status === 'sold') {
      showToast(`Seat ${seat.label} is already SOLD. Double-booking prevented by system.`);
      return;
    }
    if (seat.status === 'held' && (!activeHold || !activeHold.seatIds.includes(seat.id))) {
      showToast(`Seat ${seat.label} is currently held by another user in checkout.`);
      return;
    }

    if (selectedSeatIds.includes(seat.id)) {
      setSelectedSeatIds(prev => prev.filter(id => id !== seat.id));
    } else {
      if (selectedSeatIds.length >= 4) {
        showToast('NFR-3 Fairness Limit: Maximum 4 seats per customer to prevent bulk hoarding.');
        return;
      }
      setSelectedSeatIds(prev => [...prev, seat.id]);
    }
  };

  // Hold Seats Action (FR-4)
  const handleHoldSeats = () => {
    if (selectedSeatIds.length === 0) return;

    // Simulate PostgreSQL row lock: FOR UPDATE SKIP LOCKED
    const holdToken = 'hold_' + uuidv4().slice(0, 12);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    setEvents(prevEvents => prevEvents.map(evt => {
      if (evt.id !== selectedEvent.id) return evt;
      return {
        ...evt,
        seats: evt.seats.map(s => {
          if (selectedSeatIds.includes(s.id)) {
            return { ...s, status: 'held', heldBy: 'You' };
          }
          return s;
        })
      };
    }));

    setActiveHold({
      holdToken,
      eventId: selectedEvent.id,
      seatIds: selectedSeatIds,
      expiresAt,
      createdAt: Date.now()
    });
    setHoldSeconds(600);

    showToast(`[FR-4] Atomic Hold Granted! Token: ${holdToken}. Seats reserved for 10 minutes.`);
  };

  // Release / Cancel Hold
  const handleReleaseHold = () => {
    if (!activeHold) return;

    setEvents(prevEvents => prevEvents.map(evt => {
      if (evt.id !== activeHold.eventId) return evt;
      return {
        ...evt,
        seats: evt.seats.map(s => {
          if (activeHold.seatIds.includes(s.id)) {
            return { ...s, status: 'available', heldBy: undefined };
          }
          return s;
        })
      };
    }));

    setActiveHold(null);
    setSelectedSeatIds([]);
    setIsCheckoutOpen(false);
    showToast('[DELETE /api/holds] Hold released early. Seats returned to available pool.');
  };

  // Handle Checkout Completion (FR-5)
  const handleCompletePayment = () => {
    if (selectedSeatsList.length === 0) return;

    setIsProcessingPayment(true);

    setTimeout(() => {
      const orderItems: OrderItem[] = selectedSeatsList.map(s => ({
        seatId: s.id,
        seatLabel: s.label,
        section: s.section,
        price: s.price
      }));

      const newOrder: Order = {
        id: 'ord_' + uuidv4().slice(0, 8),
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        venue: selectedEvent.venue,
        eventDate: selectedEvent.date + ' • ' + selectedEvent.time,
        customerName,
        customerEmail,
        items: orderItems,
        subtotal,
        serviceFee,
        total: grandTotal,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        paymentId: 'ch_stripe_' + uuidv4().slice(0, 10),
        holdToken: activeHold?.holdToken
      };

      setEvents(prevEvents => prevEvents.map(evt => {
        if (evt.id !== selectedEvent.id) return evt;
        return {
          ...evt,
          availableSeats: Math.max(0, evt.availableSeats - selectedSeatIds.length),
          seats: evt.seats.map(s => {
            if (selectedSeatIds.includes(s.id)) {
              return { ...s, status: 'sold', heldBy: undefined };
            }
            return s;
          })
        };
      }));

      setOrders(prev => [newOrder, ...prev]);
      setActiveHold(null);
      setSelectedSeatIds([]);
      setIsProcessingPayment(false);
      setIsCheckoutOpen(false);

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });

      showToast(`[FR-5 Payment Success] Order ${newOrder.id} confirmed! Verified 0 double bookings.`);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-indigo-500/50 flex items-center gap-3 max-w-md animate-bounce">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Active Hold Countdown Banner (FR-4) */}
      {activeHold && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 border border-amber-500/30">
              <Clock className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base">
                  Seats Temporarily Reserved (FR-4)
                </span>
                <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 font-bold">
                  {Math.floor(holdSeconds / 60)}:{String(holdSeconds % 60).padStart(2, '0')}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Token: <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">{activeHold.holdToken}</code> — Row lock secured with <code>FOR UPDATE SKIP LOCKED</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleReleaseHold}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel Hold
            </button>
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Complete Payment</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero / Event Selector */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Browse Upcoming Events (FR-2)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select an event to load real-time seat availability and test concurrency controls.
            </p>
          </div>

          {/* Search & Category filter */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search events, artists, venues..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium w-full sm:w-auto">
              {['All', 'Concert', 'Sports', 'Theater', 'Festival'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedGenre(cat)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedGenre === cat ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Event Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredEvents.map(evt => {
            const isSelected = evt.id === selectedEventId;
            return (
              <div
                key={evt.id}
                onClick={() => {
                  setSelectedEventId(evt.id);
                  setSelectedSeatIds([]);
                }}
                className={`group rounded-xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md bg-indigo-50/20'
                    : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm bg-white'
                }`}
              >
                <div>
                  <div className="relative h-32 overflow-hidden bg-slate-100">
                    <img
                      src={evt.image}
                      alt={evt.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
                      {evt.genre}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 text-slate-800 backdrop-blur-sm">
                      From ${evt.minPrice}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{evt.artistOrOrganizer}</p>

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{evt.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{evt.venue}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Available:</span>
                    <span className="font-semibold text-emerald-600">{evt.availableSeats} seats</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Interactive Seat Map (FR-3) & Booking Panel */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-3">
        {/* Seat Map Visualization Area */}
        <div className="p-6 sm:p-8 lg:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">
                Live Event Seat Grid (FR-3)
              </span>
              <h3 className="text-xl font-bold text-slate-900">{selectedEvent.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedEvent.venue} • {selectedEvent.city}</p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-400"></span>
                <span className="text-slate-600">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-indigo-600 border border-indigo-700"></span>
                <span className="text-slate-600">Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 animate-pulse"></span>
                <span className="text-slate-600">Held (10m)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300"></span>
                <span className="text-slate-400">Sold</span>
              </div>
            </div>
          </div>

          {/* Stage Element */}
          <div className="my-8 max-w-xl mx-auto text-center">
            <div className="w-full h-10 bg-gradient-to-b from-indigo-500/20 via-purple-500/10 to-transparent border-t-4 border-indigo-600 rounded-t-full flex items-center justify-center shadow-inner">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-700">
                MAIN STAGE / PERFORMANCE PLATFORM
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Sound & Lighting Canopy</div>
          </div>

          {/* Seat Grid Layout */}
          <div className="space-y-6 max-w-xl mx-auto">
            {(['VIP', 'Orchestra', 'Balcony'] as const).map(section => {
              const sectionSeats = selectedEvent.seats.filter(s => s.section === section);
              const rows = Array.from(new Set(sectionSeats.map(s => s.row)));

              return (
                <div key={section} className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        section === 'VIP' ? 'bg-amber-500' :
                        section === 'Orchestra' ? 'bg-indigo-500' :
                        'bg-emerald-500'
                      }`}></span>
                      <span>{section} Section</span>
                    </span>
                    <span className="text-slate-500 font-normal">
                      ${section === 'VIP' ? '250' : section === 'Orchestra' ? '160' : '85'} / ticket
                    </span>
                  </div>

                  <div className="space-y-2">
                    {rows.map(row => {
                      const rowSeats = sectionSeats.filter(s => s.row === row);
                      return (
                        <div key={row} className="flex items-center gap-2 justify-center">
                          <span className="w-5 text-[11px] font-mono font-bold text-slate-400 text-right">
                            {row}
                          </span>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {rowSeats.map(seat => {
                              const isSelected = selectedSeatIds.includes(seat.id);
                              const isSold = seat.status === 'sold';
                              const isHeld = seat.status === 'held';

                              return (
                                <button
                                  key={seat.id}
                                  onClick={() => handleSeatClick(seat)}
                                  disabled={isSold || (isHeld && !isSelected)}
                                  title={`Seat ${seat.label} (${seat.section}) - $${seat.price} - ${seat.status}`}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                                      : isHeld
                                      ? 'bg-amber-400 text-slate-900 border border-amber-500 opacity-90 cursor-not-allowed'
                                      : isSold
                                      ? 'bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                                      : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 hover:scale-105'
                                  }`}
                                >
                                  {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : seat.number}
                                </button>
                              );
                            })}
                          </div>
                          <span className="w-5 text-[11px] font-mono font-bold text-slate-400 text-left">
                            {row}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selection & Checkout Summary Panel */}
        <div className="p-6 sm:p-8 bg-slate-50 flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-200">
              Selection Summary
            </h4>

            {selectedSeatsList.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <TicketIcon className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-sm font-medium text-slate-600">No seats selected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Click any available green seat on the map to add it to your order.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedSeatsList.map(seat => (
                    <div
                      key={seat.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-mono font-bold text-indigo-700 text-xs">
                          {seat.label}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{seat.section} Tier</div>
                          <div className="text-[10px] text-slate-500">Row {seat.row}, Seat {seat.number}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900">${seat.price}</span>
                        <button
                          onClick={() => handleSeatClick(seat)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Ticket Subtotal ({selectedSeatsList.length})</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Processing Fee (10%)</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Facility & Security Fee</span>
                    <span>${facilityFee.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Amount</span>
                    <span className="text-indigo-600">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {activeHold ? (
              <button
                onClick={() => setIsCheckoutOpen(true)}
                disabled={selectedSeatsList.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>Checkout Now (${grandTotal.toFixed(2)})</span>
              </button>
            ) : (
              <button
                onClick={handleHoldSeats}
                disabled={selectedSeatsList.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>Reserve & Hold Seats (10 min)</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Guaranteed 0 double-bookings with FOR UPDATE lock</span>
            </div>
          </div>
        </div>
      </section>

      {/* Checkout Modal (FR-5) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Secure Checkout (FR-5)</h3>
                  <p className="text-xs text-slate-500">PCI-DSS Tokenized Payment Gateway</p>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 space-y-4">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
                <div>
                  <span className="font-bold block">{selectedEvent.title}</span>
                  <span className="text-slate-500">{selectedSeatsList.map(s => s.label).join(', ')} • {selectedSeatsList.length} tickets</span>
                </div>
                <div className="text-right font-bold text-sm text-indigo-700">
                  ${grandTotal.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cardholder Full Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email for Digital Tickets</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mock Credit Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiration</label>
                  <input
                    type="text"
                    defaultValue="12 / 28"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 font-mono text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CVC</label>
                  <input
                    type="text"
                    defaultValue="892"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 font-mono text-center focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back to Seats
              </button>
              <button
                type="button"
                onClick={handleCompletePayment}
                disabled={isProcessingPayment}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing Transaction...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Pay ${grandTotal.toFixed(2)}</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History / My Digital Tickets Modal (FR-6) */}
      {isOrdersOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <TicketIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">My Purchased Tickets (FR-6)</h3>
                    <p className="text-xs text-slate-500">Order history with instant digital boarding passes</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOrdersOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="my-6 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <TicketIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No tickets purchased yet</p>
                    <p className="text-xs text-slate-400 mt-1">Select seats on the map and complete checkout to generate your passes.</p>
                  </div>
                ) : (
                  orders.map(order => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-gradient-to-br from-slate-50 to-white"
                    >
                      <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                            Order #{order.id}
                          </span>
                          <h4 className="font-bold text-base text-white">{order.eventTitle}</h4>
                          <p className="text-xs text-slate-400">{order.venue} • {order.eventDate}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">{order.createdAt}</span>
                          <span className="text-sm font-bold text-emerald-400">${order.total.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-dashed border-slate-200">
                        <div>
                          <span className="text-xs text-slate-500 font-medium block mb-1">Seats Assigned:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {order.items.map(item => (
                              <span
                                key={item.seatId}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono text-xs font-bold"
                              >
                                {item.seatLabel} ({item.section})
                              </span>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-2">
                            Guest: <strong className="text-slate-800">{order.customerName}</strong> ({order.customerEmail})
                          </div>
                        </div>

                        {/* Barcode & QR mock */}
                        <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shrink-0">
                          <QrCode className="w-12 h-12 text-slate-800" />
                          <div className="space-y-1">
                            <div className="h-6 w-24 bg-[repeating-linear-gradient(90deg,#000,#000_2px,transparent_2px,transparent_4px)]"></div>
                            <span className="font-mono text-[9px] text-slate-400 block text-center">
                              {order.paymentId.slice(0, 14)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsOrdersOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

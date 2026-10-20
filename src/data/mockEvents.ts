export interface Seat {
  id: string;
  label: string;
  row: string;
  number: number;
  section: 'VIP' | 'Orchestra' | 'Balcony';
  price: number;
  status: 'available' | 'held' | 'sold';
  heldBy?: string;
}

export interface Event {
  id: string;
  title: string;
  genre: 'Concert' | 'Sports' | 'Theater' | 'Festival';
  artistOrOrganizer: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  image: string;
  description: string;
  capacity: number;
  availableSeats: number;
  minPrice: number;
  maxPrice: number;
  seats: Seat[];
}

export interface OrderItem {
  seatId: string;
  seatLabel: string;
  section: string;
  price: number;
}

export interface Order {
  id: string;
  eventId: string;
  eventTitle: string;
  venue: string;
  eventDate: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  serviceFee: number;
  total: number;
  createdAt: string;
  paymentId: string;
  holdToken?: string;
}

export interface ActiveHold {
  holdToken: string;
  eventId: string;
  seatIds: string[];
  expiresAt: number; // timestamp ms
  createdAt: number;
}

export function generateSeats(): Seat[] {
  const seats: Seat[] = [];
  const rows = [
    { row: 'A', section: 'VIP' as const, price: 250 },
    { row: 'B', section: 'VIP' as const, price: 250 },
    { row: 'C', section: 'Orchestra' as const, price: 160 },
    { row: 'D', section: 'Orchestra' as const, price: 160 },
    { row: 'E', section: 'Balcony' as const, price: 85 },
    { row: 'F', section: 'Balcony' as const, price: 85 },
  ];

  const soldSet = new Set(['seat-A3', 'seat-A4', 'seat-B7', 'seat-B8', 'seat-C2', 'seat-C9', 'seat-D5', 'seat-E1', 'seat-F10']);
  const heldSet = new Set(['seat-A8', 'seat-C5', 'seat-E4']);

  for (const r of rows) {
    for (let num = 1; num <= 10; num++) {
      const id = "seat-" + r.row + num;
      let status: 'available' | 'held' | 'sold' = 'available';
      let heldBy = undefined;

      if (soldSet.has(id)) {
        status = 'sold';
      } else if (heldSet.has(id)) {
        status = 'held';
        heldBy = 'User #8429 (expiring in 4m)';
      }

      seats.push({
        id,
        label: r.row + num,
        row: r.row,
        number: num,
        section: r.section,
        price: r.price,
        status,
        heldBy,
      });
    }
  }
  return seats;
}

export const INITIAL_EVENTS: Event[] = [
  {
    id: 'evt-101',
    title: 'Neon Horizon World Tour',
    genre: 'Concert',
    artistOrOrganizer: 'Taylor Swift & The Neon Lights',
    venue: 'Apex National Stadium',
    city: 'New York, NY',
    date: 'Saturday, Nov 14, 2026',
    time: '8:00 PM',
    image: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1200&q=80',
    description: 'The record-shattering global pop tour with 360-degree holographic stage visuals and 3 hours of unforgettable hits.',
    capacity: 60000,
    availableSeats: 48,
    minPrice: 85,
    maxPrice: 250,
    seats: generateSeats(),
  },
  {
    id: 'evt-102',
    title: 'Global Esports Grand Finals',
    genre: 'Sports',
    artistOrOrganizer: 'Riot Games & Masters League',
    venue: 'Cyberdome Arena',
    city: 'Los Angeles, CA',
    date: 'Friday, Dec 04, 2026',
    time: '6:30 PM',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    description: 'The world championship battle featuring the top 4 international teams competing for the 2026 Aegis Trophy.',
    capacity: 18000,
    availableSeats: 42,
    minPrice: 85,
    maxPrice: 250,
    seats: generateSeats().map((s, idx) => ({
      ...s,
      status: idx % 5 === 0 ? 'sold' : s.status,
    })),
  },
  {
    id: 'evt-103',
    title: 'The Phantom of the Opera',
    genre: 'Theater',
    artistOrOrganizer: 'West End Revival Production',
    venue: 'Majestic Royal Hall',
    city: 'London / Broadway Tour',
    date: 'Sunday, Dec 20, 2026',
    time: '7:30 PM',
    image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    description: "Andrew Lloyd Webber's immortal gothic masterpiece reimagined with a 40-piece live orchestra and stunning stagecraft.",
    capacity: 2500,
    availableSeats: 45,
    minPrice: 85,
    maxPrice: 250,
    seats: generateSeats().map((s, idx) => ({
      ...s,
      status: idx % 6 === 0 ? 'sold' : s.status,
    })),
  },
  {
    id: 'evt-104',
    title: 'Solstice Electronic Odyssey',
    genre: 'Festival',
    artistOrOrganizer: 'Odesza, Rufus Du Sol & Lane 8',
    venue: 'Sunset Valley Amphitheater',
    city: 'Austin, TX',
    date: 'Saturday, Jan 16, 2027',
    time: '4:00 PM',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    description: 'A two-day celebration of melodic electronic music, immersive lasers, art installations, and community.',
    capacity: 35000,
    availableSeats: 39,
    minPrice: 85,
    maxPrice: 250,
    seats: generateSeats().map((s, idx) => ({
      ...s,
      status: idx % 4 === 0 ? 'sold' : s.status,
    })),
  },
];

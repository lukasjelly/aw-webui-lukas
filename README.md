# ActivityWatch Web UI

A modern Vue 3 application for visualizing ActivityWatch time tracking data. This web interface displays weekly time tracking information organized from Wednesday to Tuesday, providing insights into your computer usage patterns.

## Features

- **Weekly Time Tracking**: View time data organized in weekly cycles (Wednesday to Tuesday)
- **Visual Dashboard**: Clean, responsive interface with interactive components
- **Daily Breakdown**: Detailed view of hours tracked each day with visual progress bars
- **Week Navigation**: Easy navigation between different weeks
- **Real-time Data**: Connects directly to your local ActivityWatch server
- **Responsive Design**: Works great on desktop and mobile devices

## Prerequisites

- **ActivityWatch**: Make sure ActivityWatch is installed and running on your system
- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js

## Getting Started

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Configuration

The application connects to ActivityWatch server at `http://localhost:5600` by default. The Vite development server is configured with a proxy to avoid CORS issues during development.

If your ActivityWatch server is running on a different port, update the proxy configuration in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:YOUR_PORT', // Change this port
      changeOrigin: true,
      secure: false,
    }
  }
}
```

## Project Structure

```
src/
├── components/
│   ├── WeekView.vue          # Week navigation and date display
│   └── HoursSummary.vue      # Time data visualization
├── services/
│   └── awServerApi.ts        # ActivityWatch API integration
├── types/
│   └── index.ts              # TypeScript type definitions
├── App.vue                   # Main application component
├── main.ts                   # Application entry point
└── style.css                 # Global styles
```

## Technology Stack

- **Vue 3**: Progressive JavaScript framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and development server
- **ActivityWatch API**: Time tracking data source

## Troubleshooting

- **Connection errors**: Ensure ActivityWatch is running and accessible at `http://localhost:5600`
- **CORS issues**: The development server includes a proxy configuration to handle CORS. If you're still seeing CORS errors, verify that ActivityWatch is running and restart the dev server
- **No data showing**: Verify that ActivityWatch has been collecting data and that the watchers are active
- **Port conflicts**: If ActivityWatch is running on a different port, update the proxy target in `vite.config.ts`

## Development

This project was built with Vue 3 and TypeScript using Vite. For more information about the development setup, check out the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

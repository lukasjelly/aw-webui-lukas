# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a Vue 3 + TypeScript application built with Vite for displaying ActivityWatch time tracking data. The application shows weekly time tracking information organized from Wednesday to Tuesday.

## Key Components
- **WeekView**: Displays the current week's date range (Wednesday to Tuesday)
- **HoursSummary**: Shows total tracked hours for the week
- **AwServerApi**: Service for communicating with ActivityWatch server API

## Coding Guidelines
- Use Vue 3 Composition API with `<script setup>` syntax
- Implement proper TypeScript typing for all API responses and component props
- Follow Vue.js best practices for component structure and reactivity
- Use modern ES6+ features and async/await for API calls
- Ensure responsive design for different screen sizes
- Once the coding tasks are complete, do not output a summary or explanation of the code changes
- Do not genenrate documentation unless explicitly requested

## API Integration
- Connect to ActivityWatch server (typically running on localhost:5600)
- Handle CORS issues appropriately for local development
- Implement proper error handling for API failures
- Cache API responses when appropriate to reduce server load

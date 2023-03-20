FROM --platform=linux/amd64 node:16.8.0
RUN mkdir -p /var/app
WORKDIR /var/app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
# Start the application
CMD ["npm", "start"]
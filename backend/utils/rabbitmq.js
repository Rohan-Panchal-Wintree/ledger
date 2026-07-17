import amqp from "amqplib";

let connection = null;
let channel = null;

const queueName =
	process.env.SETTLEMENT_EMAIL_QUEUE || "settlement.email.queue";

export const getRabbitChannel = async () => {
	if (channel) return channel;

	connection = await amqp.connect(
		process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
	);

	connection.on("error", (error) => {
		console.error("RabbitMQ connection error:", error.message);
		channel = null;
		connection = null;
	});

	connection.on("close", () => {
		console.error("RabbitMQ connection closed");
		channel = null;
		connection = null;
	});

	channel = await connection.createChannel();

	await channel.assertQueue(queueName, {
		durable: true,
	});

	return channel;
};

export const publishSettlementEmailJob = async (payload) => {
	const rabbitChannel = await getRabbitChannel();

	return rabbitChannel.sendToQueue(
		queueName,
		Buffer.from(
			JSON.stringify({
				...payload,
				queuedAt: new Date().toISOString(),
			}),
		),
		{
			persistent: true,
			contentType: "application/json",
			messageId: String(payload.reportId),
			timestamp: Date.now(),
		},
	);
};

export const consumeSettlementEmailJobs = async (handler) => {
	const rabbitChannel = await getRabbitChannel();

	const concurrency = Number(process.env.SETTLEMENT_EMAIL_CONCURRENCY || 2);

	rabbitChannel.prefetch(concurrency);

	await rabbitChannel.consume(queueName, async (message) => {
		if (!message) return;

		try {
			const payload = JSON.parse(message.content.toString());

			await handler(payload);

			rabbitChannel.ack(message);
		} catch (error) {
			console.error("Settlement email job failed:", error.message);
			rabbitChannel.nack(message, false, false);
		}
	});

	console.log(`Settlement email worker listening on queue: ${queueName}`);
};

/**
 * @fileOverview Test produce and consume messages using kafka-avro.
 */
const chai = require('chai');
const expect = chai.expect;

const testLib = require('../lib/test.lib');

class TestNodeKafkaAvro {
  constructor(name, long) {
    this.name = name;
    this.long = long;
    this.__schemaName = 'org.test.TestNodeKafkaAvro';
  }
}

describe('Produce', function () {
  testLib.init();

  beforeEach(function () {
    return this.kafkaAvro.getProducer({
      'dr_cb': true,
    })
      .then(function (producer) {
        this.producer = producer;

        producer.on('event.log', function (log) {
          testLib.log.info('producer log:', log);
        });

        //logging all errors
        producer.on('error', function (err) {
          testLib.log.error('Error from producer:', err);
        });

        producer.on('delivery-report', function () {
          this.gotReceipt = true;
        }.bind(this));

        this.topicName = testLib.topic;
      }.bind(this));
  });
  afterEach(function (done) {
    this.producer.disconnect(function (err) {
      done(err);
    });
  });

  it('should produce a message with serialized key', function (done) {
    const expectedMessage = new TestNodeKafkaAvro('Thanasis', 540);
    const expectedKey = new TestNodeKafkaAvro('Key that should be serialized', 1);
    const that = this;
    this.producer.on('delivery-report', function (err, report) {
      const schemaId = report.key.readInt32BE(1);
      const schemaType = that.sr.schemaTypeById[('schema-' + schemaId)];
      const parsedKey = schemaType.decode(report.key, 5).value;

      expect(err).to.equal(null);
      expect(parsedKey.name).to.equal(expectedKey.name);
      expect(parsedKey.long).to.equal(expectedKey.long);
      expect(report.opaque).to.equal(undefined);
      this.gotReceipt = true;
    });

    this.producer.produce(this.topicName, -1, expectedMessage, expectedKey);

    //need to keep polling for a while to ensure the delivery reports are received
    const pollLoop = setInterval(() => {
      this.producer.poll();
      if (this.gotReceipt) {
        clearInterval(pollLoop);
        done();
      }
    }, 1000);
  });

  it('should produce a message with an opaque value in delivery report', function (done) {
    const message = {
      name: 'Thanasis',
      long: 540,
    };

    const key = 'key';
    const eventTime = Date.now();
    const opaqueRef = 'my-opaque-ref';

    this.producer.on('delivery-report', function (err, report) {
      expect(err).to.equal(null);
      expect(report.opaque).to.equal(opaqueRef);
      this.gotReceipt = true;
    });

    this.producer.produce(this.topicName, -1, message, key, eventTime, opaqueRef);

    //need to keep polling for a while to ensure the delivery reports are received
    const pollLoop = setInterval(() => {
      this.producer.poll();
      if (this.gotReceipt) {
        clearInterval(pollLoop);
        done();
      }
    }, 1000);
  });
  it('should not allow invalid type', function () {
    const message = new TestNodeKafkaAvro('Thanasis', '540');

    const binded = this.producer.produce.bind(this.producer, this.topicName,
      -1, message, 'key');

    expect(binded).to.throw(Error);
  });
  it('should not allow less attributes', function () {
    const message = new TestNodeKafkaAvro('Thanasis');

    const binded = this.producer.produce.bind(this.producer, this.topicName, -1, message, 'key');

    expect(binded).to.throw(Error);
  });
  it('should fail when schema is missing and shouldFailWhenSchemaIsMissing is set', function () {
    var message = {
      name: 'Thanasis',
      long: 540,
    };

    this.kafkaAvro.setShouldFailWhenSchemaIsMissing(true);
    var binded = this.producer.produce.bind(this.producer, 'topic-without-schema', -1, message, 'key');

    expect(binded).to.throw(Error);
  });

});

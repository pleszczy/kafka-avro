const SUBJECT_STRATEGIES = Object.freeze({

  /**
   * For any Avro record type that is published to Kafka topic &lt;topic&gt;,
   * registers the schema in the registry under the subject name
   * &lt;topic&gt;-&lt;recordName&gt;, where &lt;recordName&gt; is the
   * fully-qualified Avro record name. This strategy allows a topic to contain
   * a mixture of different record types, since no intra-topic compatibility
   * checking is performed. Moreover, different topics may contain mutually
   * incompatible versions of the same record name, since the compatibility
   * check is scoped to a particular record name within a particular topic.
   */
  TOPIC_RECORD_NAME_STRATEGY: 'TopicRecordNameStrategy',

  /**
   * Default subject name strategy for any messages published to
   * &lt;topic&gt;, the schema of the message key is registered under
   * the subject name &lt;topic&gt;, and the message value is registered
   * under the subject name &lt;topic&gt;.
   */
  TOPIC_NAME_STRATEGY: 'TopicNameStrategy',

  /**
   * For any Avro record type that is published to Kafka, registers the schema
   * in the registry under the fully-qualified record name (regardless of the
   * topic). This strategy allows a topic to contain a mixture of different
   * record types, since no intra-topic compatibility checking is performed.
   * Instead, checks compatibility of any occurrences of the same record name
   * across <em>all</em> topics.
   */
  RECORD_NAME_STRATEGY: 'RecordNameStrategy'

});

/**
 * A SubjectNameStrategy is used by the Avro serializer to determine
 * the subject name under which the event record schemas should be registered
 * in the schema registry. The default is TopicNameStrategy.
 */
module.exports.SubjectNameStrategy = class SubjectNameStrategy {

  prepareSubjectName(topicName, data, isKey) {
    switch (this.strategy) {
      case SUBJECT_STRATEGIES.TOPIC_RECORD_NAME_STRATEGY:
        return this.canIdentifyRecordName(data) ? `${topicName}-${this.getRecordName(data)}` : topicName;
      case SUBJECT_STRATEGIES.TOPIC_NAME_STRATEGY:
        return `${topicName}-${(isKey === false ? 'value' : 'key')}`;
      case SUBJECT_STRATEGIES.RECORD_NAME_STRATEGY:
        return this.canIdentifyRecordName(data) ? this.getRecordName(data) : topicName;
      default: //  the default strategy for confluent platform is `TOPIC_NAME_STRATEGY`
        return `${topicName}`;
    }
  }

  canIdentifyRecordName(data) {
    return (data.__schemaName != null) || (data.constructor != null && data.constructor.name !== 'Object');
  }

  getRecordName(data) {
    return data.__schemaName || data.constructor.name;
  }

  constructor(name) {
    if (name) {
      const normalizedName = name.toLowerCase();
      for (let [, value] of Object.entries(SUBJECT_STRATEGIES)) {
        if (value.toLowerCase() === normalizedName) {
          this.strategy = value;
          return;
        }
      }
      throw new Error(`Invalid subject name strategy ${name}. Allowed strategies are ${Object.values(SUBJECT_STRATEGIES)}`);
    } else {
      this.strategy = null;
    }
  }
};
